'use strict';
var routes;
var Model = require('hoist-model');
var Boom = require('boom');
var Context = require('hoist-context');
var errors = require('hoist-errors');
var logger = require('hoist-logger');
var pipeline = require('hoist-events-pipeline')(Context, Model);
var _ = require('lodash');
var BBPromise = require('bluebird');

function EventController() {

}

function checkEvents(appId, lastPoll, filterBy, filterValue) {
  var findProperties = {
    applicationId: appId,
    environment: 'live',
    createdAt: {
      $gt: lastPoll
    }
  };
  if (filterBy === 'eventName' && filterValue) {
    findProperties.eventName = filterValue;
  } else if (filterBy === 'correlationId' && filterValue) {
    findProperties.correlationId = filterValue;
  }
  return Model.Event.findAsync(findProperties);
}

function checkEventsTimeout(token, req, reply) {
  var start = token ? token.lastUsed.getTime() : req.info.received;
  var finish = req.info.received + req.query.timeoutMS;
  var interval = setInterval(function () {
    var pollDate = Date.now();
    checkEvents(req.auth.credentials._id, start, req.query.filterBy, req.query.filterValue)
      .then(function (events) {
        if (events.length || Date.now() >= finish) {
          clearInterval(interval);
          events = _.map(events, function (ev) {
            return ev.toObject();
          });
          new Model.EventToken({
            application: req.auth.credentials._id,
            environment: 'live',
            lastUsed: pollDate
          }).saveAsync().then(function (newToken) {
            reply({
              token: newToken.code,
              events: events
            }).code(201);
          });
        }
      });
  }, 100);
}

EventController.prototype.getStream = function (req, reply) {
  req.query.timeoutMS = req.query.timeoutMS && !isNaN(req.query.timeoutMS) ? parseInt(req.query.timeoutMS) : 10000;
  BBPromise.method(function () {
    if (req.query.token) {
      return Model.EventToken.findOneAsync({
        code: req.query.token,
        application: req.auth.credentials._id,
        environment: 'live'
      });
    }
    return null;
  })().then(function (token) {
    if (token && token.lastUsed > req.info.received - 10 * 60 * 1000) {
      var pollDate = Date.now();
      return checkEvents(req.auth.credentials._id, token.lastUsed, req.query.filterBy, req.query.filterValue)
        .then(function (events) {
          if (events && events.length) {
            events = _.map(events, function (ev) {
              return ev.toObject();
            });
            new Model.EventToken({
              application: req.auth.credentials._id,
              environment: 'live',
              lastUsed: pollDate
            }).saveAsync().then(function (newToken) {
              reply({
                token: newToken.code,
                events: events
              }).code(201);
            })
          } else {
            checkEventsTimeout(token, req, reply);
          }
        });
    } else {
      checkEventsTimeout(null, req, reply);
    }
  });
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
  Context.namespace.run(function () {
    Context.get().then(function (context) {
      context.application = req.auth.credentials;
      context.environment = 'live';

      pipeline.raise(req.params.eventName, req.payload).then(function (ev) {
        reply(ev.toObject())
          .type('application/json; charset=utf-8')
          .code(201);
      }).catch(function (err) {
        if (!errors.isHoistError(err)) {
          logger.error(err);
          err = new errors.hoistError();
        }
        reply(Boom.wrap(err, parseInt(err.code)));
      });
    }).catch(function (err) {
      logger.alert(err);
    });
  });
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