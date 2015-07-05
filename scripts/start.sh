#!/usr/bin/env bash
set -e

#setup config
echo "setting up app config"
cp /config/production.json ./config/production.json

#start app
echo "starting app"
node app.js
