'use strict';
/**
 * validate input args
 */
const minimist = require('minimist'),
      fs = require('fs'),
      moment = require('moment'),
      sequence = require('futures').sequence(),
      chalk = require('chalk')
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

let args = minimist(process.argv.slice(2), {
    default: {
        port: 8080
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
  .then((next) => {
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
      sourceConnection.end();
      next();
    });
  })

  .then((next) => {
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
      next();
    });
  })

  .then((next, err) => {
    // TODO: create target DB
    log(chalk.yellow("creating database target"));

    var targetDatabaseName = loadedConfig.target.database;

    if(loadedConfig.target.timestamp){
      targetDatabaseName = targetDatabaseName + moment().format("YYYYMMDDHHmmss");
    }

    var passthru = {
      targetDatabaseName: targetDatabaseName
    };
    var createCommand = `mysql`+
      ` -h"${loadedConfig.target.host}"`+
      ` -u"${loadedConfig.target.user}"`+
      ` -p"${loadedConfig.target.password}"`+
      ` -P"${loadedConfig.target.port}"`+
      ` -e"create database ${targetDatabaseName};"`;
    log(chalk.bgYellow.black("TODO createCommand"),createCommand);

    // TODO: clone structure of source db -> target DB
    var cloneStructureCommandDump = `mysqldump`+
      ` ${mysqlDumpOptions} --no-data`+
      ` -h"${loadedConfig.source.host}"`+
      ` -u"${loadedConfig.source.user}"`+
      ` -p"${loadedConfig.source.password}"`+
      ` -P"${loadedConfig.source.port}"`+
      ` ${loadedConfig.source.database}`;

    var cloneStructureCommandImport = `mysql`+
      ` -h"${loadedConfig.target.host}"`+
      ` -u"${loadedConfig.target.user}"`+
      ` -p"${loadedConfig.target.password}"`+
      ` -P"${loadedConfig.target.port}"`+
      ` ${targetDatabaseName}`;
    // import_command="mysql $t_options -h$t_host -u$t_user -p'$t_password' $t_database"
    var cloneStructureCommand = `${cloneStructureCommandDump} | ${cloneStructureCommandImport}`;
    log(chalk.bgYellow.black("TODO cloneStructureCommandDump"),cloneStructureCommandDump);
    log(chalk.bgYellow.black("TODO cloneStructureCommandImport"),cloneStructureCommandImport);
    log(chalk.bgYellow.black("TODO cloneStructureCommand"),cloneStructureCommand);

    // TODO: get list of tables then double check with loadedConfig.options.skip (skip table)
    // TODO: get list of tables then double check with loadedConfig.options.where (limit or special rule)
    // setTimeout(next, 500); // testing delay
    next(err, passthru);
  })

  .then((next, err, passthru) => {
    log("received", passthru);
    next();
  }) // just duplicate this function if you want to add a sequence

  .then((next) => {
    log(chalk.cyan("new sequence"));
    next();
  }) // just duplicate this function if you want to add a sequence

  .then((next) => {
    /**
     * all tasks done
     */
    log(chalk.green("all done!"));
    next();
  }); // end of sequence