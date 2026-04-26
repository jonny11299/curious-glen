#!/bin/bash
cd "$(dirname "$0")"

read -p "Retrieve fresh articles? (y/n): " answer
case "$answer" in
  [yY][eE][sS]|[yY])
    node src/loop/run.js;
	node src/loop/report.js;
	node src/connections/weaver.js;
    ;;
esac

sleep 0.1
cd renders/mind
npm run dev
