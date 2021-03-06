# node.mysql.cloner
command line utility to clone database from target to source with options to select only relevant data

NOTE: because it uses the option `--lock-tables=false` when dumping data, it is not recommended for data durability in high-traffic databases

## configuration

### application.json
```
{
  "mysql_path":"/usr/bin/mysql", // the path where your mysql is located
  "mysqldump_path":"/usr/bin/mysqldump" // the path where your mysqldump is located
}
```

### configs/job.json.example
```
/** 
 * note: when saving this file, make sure there are no comments, new lines, extra commas to avoid errors
 */
{
 /**
  * the source connection details
  */
  "source":{
    "host":"localhost",
    "port":"3306",
    "user":"root",
    "password":"EXAMPLE123",
    "database":"db_main"
  },
  
 /**
  * the source connection details
  */
  "target":{
    "host":"localhost",
    "port":"3306",
    "user":"root",
    "password":"EXAMPLE123",
    "database":"db_target_",
    "timestamp":true
  },
  
  "options":{
   /**
    * cloner will copy the structure of the following but will not copy the data
    */
    "skip-data":[
      "tbl_logs_1",
      "tbl_logs_2",
      "tbl_logs_3",
      "tbl_logs_4",
      "tbl_logs_5",
      "tbl_logs_6",
      "tbl_logs_7",
      "tbl_logs_8",
      "tbl_logs_9",
      "tbl_logs_10",
      "tbl_logs_11",
      "tbl_logs_12",
      "tbl_logs_13",
      "tbl_logs_14",
      "tbl_logs_15",
      "tbl_logs_16",
      "tbl_logs_17",
      "tbl_logs_18",
      "tbl_logs_19",
      "tbl_logs_20",
      "tbl_logs_21",
      "tbl_logs_22"
    ],
    
   /**
    * mysqldump --where clause will be added per table
    */
    "where":{
      "tbl_access_logs":"id > (select max(id)-100000 from tbl_access_logs)",
      "tbl_debug_logs":"id > (select max(id)-100000 from tbl_debug_logs)"
    }
  }
}
```
