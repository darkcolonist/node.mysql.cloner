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

function log(...message){
  var curseconds = new Date().getTime();
  var dur = curseconds - appseconds;
  appseconds = new Date().getTime();
  console.log(moment().format(),":", ...message, chalk.cyan("+"+dur+"ms"));
}

function terminate(...message){
  var curseconds = new Date().getTime();
  var dur = curseconds - appseconds;
  appseconds = new Date().getTime();
  console.log(moment().format(),":", chalk.red(...message), chalk.yellow("+"+dur+"ms"));
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

  .then((next) => {
    /**
     * create dump scripts
     */
    // create target db first
    log(chalk.yellow("creating database target"));
    setTimeout(next, 2000); // testing
    // next();
  })

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