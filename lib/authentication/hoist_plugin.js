'use strict';

import Boom from 'boom';
import logger from '@hoist/logger';
import {
  Application
}
from '@hoist/model';
import Context from '@hoist/context';

/**
 * an authentication scheme for Hoist requests
 */
class HoistAuthentication {
  /**
   * construct a new instance
   */
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
  }

  /**
   * map this instance for the Hapi Scheme
   */
  scheme() {
    return () => {
      return this;
    };
  }

  /**
   * authenticate the request
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  authenticate(request, reply) {
    this._logger.info('in authenticte');
    var req = request.raw.req;
    var authorization = req.headers.authorization;
    if (!authorization) {
      this._logger.info('no authorization header');
      return reply(Boom.unauthorized(null, 'Hoist'));
    }
    this._logger.info('getting auth parts');
    var parts = authorization.split(/\s+/);


    if (parts[0].toLowerCase() !== 'hoist') {
      this._logger.warn('not a hoist authorization header');
      return reply(Boom.unauthorized(null, 'Hoist'));
    }

    if (parts.length !== 2) {
      this._logger.warn('not a valid authorization header');
      return reply(Boom.badRequest('Bad HTTP authentication header format', 'Hoist'));
    }
    var apiKey = parts[1];
    this._logger.info('finding application');
    return Application.findOneAsync({
      apiKey: apiKey
    }).then((application) => {
      if (!application) {
        this._logger.warn('not a valid api key');
        return reply(Boom.unauthorized('Invalid API Key', 'Hoist'));
      }
      this._logger.info('authenticated');
      let context = new Context({
        application: application.toObject(),
        environment: 'live'
      });
      reply.continue({
        credentials: context
      });
    });
  }
}

var hoist = new HoistAuthentication();
export default HoistAuthentication;

/**
 * register the hoist authentication scheme
 */
export function register(server, options, next) {
  server.auth.scheme('hoist', hoist.scheme());
  server.auth.strategy('hoist', 'hoist');
  next();
}
register.attributes = {
  pkg: {
    "name": "hoist-api-key-auth",
    "description": "Hoist API Key Authentication",
    "version": "1.0.0"
  }
};
