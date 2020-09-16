# node.mysql.cloner
command line utility to clone database from target to source with options to select only relevant data

NOTE: because it uses the option `--lock-tables=false` when dumping data, it is not recommended for data durability in high-traffic databases
