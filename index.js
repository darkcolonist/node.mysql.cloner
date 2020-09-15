'use strict';

const minimist = require('minimist'),
      fs = require('fs'),
      moment = require('moment');

function log(...message){
  console.log(moment().format(),":", ...message);
}

let args = minimist(process.argv.slice(2), {
    default: {
        port: 8080
    },
});

if(args.file === undefined || args.file == ""){
  log("usage:\nnode index.js --file=\"./db-config.json\"");
  process.exit(1);
}

if(!fs.existsSync(args.file)){
  log(args.file, "file not found.");
}

var json = {};
try{
  json = require(args.file);

  // var rawData = fs.readFileSync(args.file, "utf8");
  // json = JSON.parse(JSON.stringify(rawData));
}catch(e){
  log("malformed json file in", args.file);
  log(e);
  process.exit(1);
}

log(json.source.user);