'use strict';
import Boom from 'boom';
import errors from '@hoist/errors';
import logger from '@hoist/logger';
import Pipeline from '@hoist/events-pipeline';

/**
 * API Controller for /event endpoints
 */
class EventController {
  /**
   * create new instance
   */
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
    this._pipeline = new Pipeline();
  }

  /**
   * create a brand new event
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  createEvent(req, reply) {
    return this._pipeline.raise(req.auth.credentials, req.params.eventName, req.payload)
      .then((ev) => {
        reply(ev)
          .type('application/json; charset=utf-8')
          .code(201);
      }).catch((err) => {
        if (!errors.isHoistError(err)) {
          logger.error(err);
          err = new errors.HoistError();
        }
        reply(Boom.wrap(err, parseInt(err.code)));
      });
  }

  /**
   * get an event
   * @depreciated
   */
  getEvent(req, reply) {
    reply(new Boom());
  }

  /**
   * get an event in a stream or continue an existing stream
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  getStream(req, reply) {
    reply(new Boom());
  }

  /**
   * map routes for this controller
   * @param {HapiServer} server - the Hapi Server instance
   */
  mapRoutes(server) {
    this._logger.info('mapping server routes');
    let routePrefix = '/event';
    server.route([{
      // GET /events
      path: routePrefix + 's',
      method: ['GET'],
      handler: this.getStream,
      config: {
        auth: 'hoist',
        bind: this
      }
    }, {
      // GET /event
      path: routePrefix + '/{id}',
      method: ['GET'],
      handler: this.getEvent,
      config: {
        auth: 'hoist',
        bind: this
      }
    }, {
      // POST /event/eventName

      path: routePrefix + '/{eventName}',
      method: ['POST'],
      handler: this.createEvent,
      config: {
        auth: 'hoist',
        bind: this
      }
    }]);
  }
}

export default EventController;

/*

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
            });
          } else {
            checkEventsTimeout(token, req, reply);
          }
        });
    } else {
      checkEventsTimeout(null, req, reply);
    }
  });
};
EventController.prototype.;
EventController.prototype.;
EventController.prototype.getRoutes = function () {
  return routes;
};
var eventPrefix = '/event';
var controller = new EventController();
routes = ;

module.exports = controller;
*/
