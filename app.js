'use strict';

var server = require('./lib/server');
var logger = require('hoist-logger');

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
