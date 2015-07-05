'use strict';
import Bluebird from 'bluebird';
import {
  _mongoose
}
from '@hoist/model';
import config from 'config';
import Router from './router';
import logger from '@hoist/logger';
import Hapi from 'hapi';
Bluebird.promisifyAll(_mongoose);

/**
 * a wrapper around the HapiServer
 */

class Server {

  /**
   * create a new instance
   */
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
    this._router = new Router();
  }

  _configurePlugins() {
    this._hapiServer.register([
      require('./authentication/hoist_plugin')
    ], function () {

    });
  }
  _createServer() {
    this._hapiServer = new Hapi.Server();
    this._hapiServer.connection({
      host: config.get('Hoist.http.host'),
      port: config.get('Hoist.http.port')
    });
    this._configurePlugins();
    this._router.map(this._hapiServer);
    Bluebird.promisifyAll(this._hapiServer);

  }

  /**
   * start the server and configure it
   */
  start() {
    this._createServer();
    return this._hapiServer.startAsync()
      .then(function () {
        return _mongoose.connectAsync(config.get('Hoist.mongo.core.connectionString'));
      });
  }

  /**
   * stop the server
   */
  stop() {
    return this._hapiServer.stopAsync()
      .then(function () {
        return _mongoose.disconnectAsync();
      });
  }
}

export default Server;

/**
 * @external {HapiServer} http://hapijs.com/api#server
 */

/**
 * @external {Request} http://hapijs.com/api#request-object
 */

/**
 * @external {Reply} http://hapijs.com/api#reply-interface
 */
