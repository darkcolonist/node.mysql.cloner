'use strict';
/**
 * validate input args
 */
const minimist = require('minimist'),
      fs = require('fs'),
      moment = require('moment'),
      sequence = require('futures').sequence(),
      chalk = require('chalk'),
      { exec } = require('child_process'),
      appconfig = require('./application.json')
    ;

var appseconds = new Date().getTime();
var mysqlDumpOptions = "--lock-tables=false --skip-extended-insert";

function log(...message){
  var curseconds = new Date().getTime();
  var dur = curseconds - appseconds;
  appseconds = new Date().getTime();
  var timestamp = chalk.grey(moment().format("YYYY-MM-DD HH:mm:ss"));
  console.log(timestamp, ...message, chalk.blueBright.dim("+"+dur+"ms"));
}

function terminate(...message){
  var curseconds = new Date().getTime();
  var dur = curseconds - appseconds;
  appseconds = new Date().getTime();
  var timestamp = chalk.grey(moment().format("YYYY-MM-DD HH:mm:ss"));
  console.log(timestamp, chalk.red(...message), chalk.yellow.dim("+"+dur+"ms"));
  process.exit(1);
}

log('starting application');

log("application.json loaded");
log("mysql path", "\""+appconfig.mysql_path+"\"");
log("mysqldump path", "\""+appconfig.mysqldump_path+"\"");

let args = minimist(process.argv.slice(2), {
    default: {
        something: "nothing"
    },
});

if(args.file === undefined || args.file == ""){
  terminate("usage:\nnode index.js --file=\"db-config.json\"");
}

if(!args.file.endsWith(".json")){
  terminate("error: file should be a valid .json file. example: ./configs/job.json");
}

if(!fs.existsSync(args.file)){
  terminate(args.file, "file not found.");
}

log("loading",args.file);
var loadedConfig = {};
try{
  loadedConfig = require("./"+args.file);
}catch(e){
  terminate("malformed loadedConfig file in", args.file, e);
}

/**
 * test mysql connections
 */
const mysql = require('mysql');

sequence
  .then((next, err) => {
    // test source connection
    const sourceConnection = mysql.createConnection({
      host: loadedConfig.source.host,
      port: loadedConfig.source.port,
      user: loadedConfig.source.user,
      password: loadedConfig.source.password,
      database: loadedConfig.source.database
    });
    log("testing connection to source");
    sourceConnection.connect((err) => {
      if(err){
        terminate("problem connecting");
      }
      log("passed");
      next(err, { sourceConnection: sourceConnection });
    });
  })

  .then((next, err, passthru) => {
    var sourceConnection = passthru.sourceConnection;

    var statement = `SELECT TABLE_NAME AS _tables`+
      ` FROM INFORMATION_SCHEMA.TABLES`+
      ` WHERE TABLE_SCHEMA = '${loadedConfig.source.database}'`;

    sourceConnection.query(statement, (err, result) => {
      if(err)
        terminate("unable to fetch tables from source", err);

      sourceConnection.end();

      var tables = [];
      var skipped = [];
      var hasWhere = [];

      // get list of tables then double check with loadedConfig.options.skip (skip table)
      // get list of tables then double check with loadedConfig.options.where (limit or special rule)
      for (var i = 0; i < result.length; i++) {
        let resultTableName = result[i]["_tables"];
        let where = undefined;

        if(loadedConfig.options["skip-data"].indexOf(resultTableName) != -1){
          skipped.push(resultTableName);
          continue; // skip this table
        }

        if(loadedConfig.options.where[resultTableName] != undefined){
          hasWhere.push(resultTableName);
          where = loadedConfig.options.where[resultTableName];
        }
        
        tables.push({
          name: resultTableName,
          where: where
        });
      }

      log(result.length, "tables found in source");
      log(skipped.length, "tables skipped");
      log(tables.length, "tables to process");
      log(hasWhere.length, "tables that have conditions");

      next(err, { tables: tables });
    })
  })

  .then((next, err, passthru) => {
    // test target connection
    const targetConnection = mysql.createConnection({
      host: loadedConfig.target.host,
      port: loadedConfig.target.port,
      user: loadedConfig.target.user,
      password: loadedConfig.target.password
      // database: loadedConfig.target.database // non-existent yet
    });
    log("testing connection to target");
    targetConnection.connect((err) => {
      if(err){
        terminate("problem connecting");
      }
      log("passed");
      targetConnection.end();
      next(err, passthru);
    });
  })

  .then((next, err, passthru) => {
    // create target DB
    log(chalk.yellow("creating database target"));

    var targetDatabaseName = loadedConfig.target.database;

    if(loadedConfig.target.timestamp){
      targetDatabaseName = targetDatabaseName + moment().format("YYYYMMDDHHmmss");
    }

    passthru.targetDatabaseName = targetDatabaseName;

    var createCommand = appconfig.mysql_path +
      ` -h"${loadedConfig.target.host}"`+
      ` -u"${loadedConfig.target.user}"`+
      ` -p"${loadedConfig.target.password}"`+
      ` -P"${loadedConfig.target.port}"`+
      ` -e"create database ${targetDatabaseName};"`;
    // log(chalk.bgYellow.black("TODO createCommand"),createCommand);
    exec(createCommand, (err, stdout, stderr) => {
      if(err){
        log(stderr);
        terminate("target database can't be created");
      }
      log("target database created successfully");
      next(err, passthru);
    });
  })

  .then((next, err, passthru) => {
    // log("received", passthru);
    log(chalk.yellow("cloning source structure into target"));

    var targetDatabaseName = passthru.targetDatabaseName;

    // clone structure of source db -> target DB
    var cloneStructureCommandDump = appconfig.mysqldump_path +
      ` ${mysqlDumpOptions} --no-data`+
      ` -h"${loadedConfig.source.host}"`+
      ` -u"${loadedConfig.source.user}"`+
      ` -p"${loadedConfig.source.password}"`+
      ` -P"${loadedConfig.source.port}"`+
      ` ${loadedConfig.source.database}`;

    var cloneStructureCommandImport = appconfig.mysql_path +
      ` -h"${loadedConfig.target.host}"`+
      ` -u"${loadedConfig.target.user}"`+
      ` -p"${loadedConfig.target.password}"`+
      ` -P"${loadedConfig.target.port}"`+
      ` ${targetDatabaseName}`;

    var cloneStructureCommand = `${cloneStructureCommandDump} | ${cloneStructureCommandImport}`;

    exec(cloneStructureCommand, (err, stdout, stderr) => {
      if(err){
        log(stderr);
        terminate("cloning failed");
      }
      log("cloning success");
      next(err, passthru);
    });
  })

  .then((next, err, passthru) => {
    // import tables one by one
    // log("TODO: import tables one by one sequentially");
    log(chalk.yellow("processing tables now"));

    // var targetDatabaseName = passthru.targetDatabaseName;
    var targetDatabaseName = "_delete_me_20200916161331"; // TODO: test
    var tables = passthru.tables;

    function tableJob(tables, index){
      if(tables[index] !== undefined){
        var theTable = tables[index];
        log("processing", theTable.name, `(${index+1}/${tables.length})`);

        var whereClause = "";

        if(theTable.where !== undefined)
          whereClause = ` --where="${theTable.where}"`;

        // clone structure of source db -> target DB
        var cloneTableDataCommandDump = appconfig.mysqldump_path +
          ` ${mysqlDumpOptions}`+
          ` -h"${loadedConfig.source.host}"`+
          ` -u"${loadedConfig.source.user}"`+
          ` -p"${loadedConfig.source.password}"`+
          ` -P"${loadedConfig.source.port}"`+
          ` ${whereClause}`+
          ` ${loadedConfig.source.database} ${theTable.name}`;

        var cloneTableDataCommandImport = appconfig.mysql_path +
          ` -h"${loadedConfig.target.host}"`+
          ` -u"${loadedConfig.target.user}"`+
          ` -p"${loadedConfig.target.password}"`+
          ` -P"${loadedConfig.target.port}"`+
          ` ${targetDatabaseName}`;
          
        var cloneTableDataCommand = `${cloneTableDataCommandDump} | ${cloneTableDataCommandImport}`;

        /*log(cloneTableDataCommand);
        tableJob(tables, index + 1);*/

        exec(cloneTableDataCommand, (err, stdout, stderr) => {
          if(err){
            log(stderr);
            terminate("cloning failed");
          }

          log(theTable.name, "done");
          
          if(index < tables.length)
            tableJob(tables, index + 1);
          else
            next(); // all tables are done
        });
      }
    }

    tableJob(tables, 0);
  })

  // .then((next) => {
  //   log(chalk.cyan("new sequence"));
  //   next();
  // }) // just duplicate this function if you want to add a sequence

  .then((next) => {
    /**
     * all tasks done
     */
    log(chalk.green("all done!"));
    next();
  }); // end of sequence