'use strict';

var Boom = require('boom');
var Model = require('hoist-model');
var _ = require('lodash');
var logger = require('hoist-logger');

function HoistAuthentication() {

}

HoistAuthentication.prototype.scheme = function () {
  return this;
};
/* istanbul ignore next*/
HoistAuthentication.prototype.authenticate = function (request, reply) {
  var req = request.raw.req;
  var authorization = req.headers.authorization;
  if (!authorization) {
    return reply(Boom.unauthorized(null, 'Hoist'));
  }
  logger.info('getting auth parts');
  var parts = authorization.split(/\s+/);


  if (parts[0].toLowerCase() !== 'hoist') {
    logger.warn('not a hoist authorization header');
    return reply(Boom.unauthorized(null, 'Hoist'));
  }

  if (parts.length !== 2) {
    logger.warn('not a valid authorization header');
    return reply(Boom.badRequest('Bad HTTP authentication header format', 'Hoist'));
  }
  var apiKey = parts[1];
  Model.Application.findOneAsync({
    apiKey: apiKey
  }).then(function (application) {
    if (!application) {
      logger.warn('not a valid api key');
      return reply(Boom.unauthorized('Invalid API Key', 'Hoist'));
    }
    logger.info('authenticated');
    reply.continue({
      credentials: application.toObject()
    });
  });
};

var hoist = new HoistAuthentication();

exports.register = function (server, options, next) {
  server.auth.scheme('hoist', _.bind(hoist.scheme, hoist));
  server.auth.strategy('hoist', 'hoist');
  next();
};
exports.register.attributes = {
  pkg: {
    "name": "hoist-api-key-auth",
    "description": "Hoist API Key Authentication",
    "version": "1.0.0",
  }
};
