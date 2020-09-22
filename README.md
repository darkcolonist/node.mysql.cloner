# node.mysql.cloner
command line utility to clone database from target to source with options to select only relevant data

NOTE: because it uses the option `--lock-tables=false` when dumping data, it is not recommended for data durability in high-traffic databases

## configuration `application.json`
```
{
  "mysql_path":"/usr/bin/mysql", // the path where your mysql is located
  "mysqldump_path":"/usr/bin/mysqldump" // the path where your mysqldump is located
}
```
