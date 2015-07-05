'use strict';

var Server = require('./lib/server');
var logger = require('@hoist/logger');
process.title = 'hoist-http-host';
require('babel/register');
var server = new Server();

server.start().then(function () {
  logger.info('server started');
});
process.on('message', function (msg) {
  if (msg === 'shutdown') {
    process.nextTick(function () {
      server.stop()
        .then(function () {
          logger.info('closed server down');
          process.exit(0);
        });
    });
  }
});
