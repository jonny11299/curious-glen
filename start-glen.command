#!/bin/bash
cd "$(dirname "$0")"

read -p "Retrieve fresh articles? (y/n): " answer
case "$answer" in
  [yY][eE][sS]|[yY])
    node src/controller/index.js;
	node src/controller/report.js;
	node src/connectors/weaver.js;
    ;;
esac

sleep 0.1
cd renders/mind
npm run dev
