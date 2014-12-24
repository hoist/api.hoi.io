'use strict';
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('hoist-model')._mongoose);
var config = require('config');
var router = require('./router');
var Hapi = require('hapi');

function Server() {

}

Server.prototype.configurePlugins = function (server) {
  server.register([
    require('./authentication/hoist_plugin')
  ],function(){

  });
};

Server.prototype.createServer = function () {
  var hapiServer = new Hapi.Server();
  hapiServer.connection({
    port: config.get('Hoist.http.port')
  });
  this.configurePlugins(hapiServer);
  router.map(hapiServer);
  return BBPromise.promisifyAll(hapiServer);

};

Server.prototype.start = function () {
  this.server = this.createServer();
  return this.server.startAsync()
    .then(function () {
      return mongoose.connectAsync(config.get('Hoist.mongo.db'));
    });
};
Server.prototype.stop = function () {
  return this.server.stopAsync()
    .then(function () {
      return mongoose.disconnectAsync();
    });
};

module.exports = new Server();
