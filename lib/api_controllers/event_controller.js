'use strict';
var routes;
var Model = require('hoist-model');
var Boom = require('boom');
var errors = require('hoist-errors');
var logger = require('hoist-logger');

function EventController() {

}
EventController.prototype.getStream = function (req, reply) {
  reply({});
};
EventController.prototype.getEvent = function (req, reply) {
  Model.Event.findOneAsync({
    eventId: req.params.id
  }).then(function (event) {
    if (!event) {
      throw new errors.Http404Error('event not found');
    }
    reply(event.toObject());
  }).catch(function (err) {
    if (!errors.isHoistError(err)) {
      logger.error(err);
      err = new errors.hoistError();
    }
    reply(Boom.wrap(err, parseInt(err.code)));
  });

};
EventController.prototype.createEvent = function (req, reply) {
  var response = reply({
    eventId: "{id}",
    eventName: "my:event",
    correlationId: "correlationid",
    createdAt: new Date(),
    payload: {
      key: "some other"
    }
  });
  response.statusCode = 201;
};
EventController.prototype.getRoutes = function () {
  return routes;
};
var eventPrefix = '/event';
var controller = new EventController();
routes = [{
  // GET /events
  path: eventPrefix + 's',
  method: ['GET'],
  handler: controller.getStream,
  config: {
    auth: 'hoist',
    bind: controller
  }
}, {
  // GET /event
  path: eventPrefix + '/{id}',
  method: ['GET'],
  handler: controller.getEvent,
  config: {
    auth: 'hoist',
    bind: controller
  }
}, {
  // POST /event/eventName

  path: eventPrefix + '/{eventName}',
  method: ['POST'],
  handler: controller.createEvent,
  config: {
    auth: 'hoist',
    bind: controller
  }
}];

module.exports = controller;
