'use strict';
import Boom from 'boom';
import errors from '@hoist/errors';
import logger from '@hoist/logger';
import {
  Receiver
}
from '@hoist/broker';
import Pipeline from '@hoist/events-pipeline';
import amqp from 'amqplib';
import config from 'config';
import moment from 'moment';
import Bluebird from 'bluebird';
import {
  EventToken
}
from '@hoist/model';

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
    this._logger.info('created new event controller');
    this._pipeline = new Pipeline();
    this._receiver = new Receiver();
  }
  _getChannel() {
    return amqp.connect(config.get('Hoist.rabbit.url'))
      .then((connection) => {
        connection.on('error', (err) => {
          this._logger.error(err);
        });
        return connection.createChannel()
          .then((channel) => {
            channel.on('error', (err) => {
              this._logger.error(err);
              connection.close();
            });
            return channel;
          });
      });
  }
  /**
   * create a brand new event
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  createEvent(req, reply) {
    let eventName = req.params.eventName;
    let context = req.auth.credentials;
    this._logger.info({
      application: context.application._id,
      eventName
    }, 'raising an event');
    let priority = req.headers['x-priority'] || 3;
    return this._pipeline.raise(context, eventName, req.payload, {
        priority
      })
      .then((ev) => {
        this._logger.info({
          application: context.application._id,
          eventName
        }, 'event raised');
        reply(ev)
          .type('application/json; charset=utf-8')
          .code(201);
      }).catch((err) => {
        if (!errors.isHoistError(err)) {
          this._logger.error(err);
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
   * get an events payload
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  getEventPayload(req, reply) {

    let context = req.auth.credentials;
    this._logger.info({
      application: context.application._id
    }, 'requesting event payload');
    return this._receiver._getPayloadFromId(context.application._id, req.params.id)
      .then(function (payload) {
        reply(payload);
      });

  }

  /**
   * get an event in a stream or continue an existing stream
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  getStream(req, reply) {
    //ensure we have a connection to rabbitmq
    let context = req.auth.credentials;
    let token = req.query.token;
    let filterBy = req.query.filterBy;
    let filterValue = req.query.filterValue;
    let timeout = req.query.timeoutMS && !isNaN(req.query.timeoutMS) ? parseInt(req.query.timeoutMS) : 10000;
    let timeoutTime = moment().add(timeout, 'ms');
    this._logger.info('ensuring rabbitmq is connected');

    return this._getOrCreateStreamToken(token, context, filterBy, filterValue)
      .then((eventToken) => {
        //consume queue and start timeout
        let events = [];
        return this._composeStreamReply(reply, eventToken, events, timeoutTime, null, false);
      }).catch((err) => {
        this._logger.error(err);
        reply(err);
      });
  }
  _composeStreamReply(reply, eventToken, events, timeoutTime, channel, finished, i) {
    i = i || 0;
    i++;
    logger.info({
      i: i
    }, 'looping');
    if (!channel) {
      return this._getChannel().then((ch) => {
        return this._composeStreamReply(reply, eventToken, events, timeoutTime, ch, finished);
      });
    }
    if (!finished) {
      this._logger.info({
        events: events.length,
        token: eventToken.code,
        finished
      }, 'checking for new messages');
      //pull events from queue till we don't have any;
      channel.get(`${eventToken.code}_stream`, {
        noAck: true
      }).then((message) => {
        finished = false;
        if (!message && events.length > 0) {
          this._logger.info({
            events: events.length,
            token: eventToken.code,
            timeoutTime
          }, 'end of current messages');
          finished = true;
        } else if (!message && moment().isAfter(timeoutTime)) {
          this._logger.info({
            events: events.length,
            token: eventToken.code,
            timeoutTime
          }, 'timed out');
          finished = true;
        } else if (message) {
          this._logger.info({
            events: events.length,
            token: eventToken.code,
            timeoutTime
          }, 'adding message');
          let event = JSON.parse(message.content.toString());
          events.push(event);
        }
        this._logger.info({
          events: events.length,
          token: eventToken.code,
          timeoutTime
        }, 'recursing');
        let delay = timeoutTime.diff(moment());
        if (delay > 15000) {
          delay = 15000;
        }
        return Bluebird.delay(delay).then(() => {
          return this._composeStreamReply(reply, eventToken, events, timeoutTime, channel, finished, i);
        });
      });

    } else {
      channel.connection.close();
      this._logger.info({
        events: events.length,
        token: eventToken.code,
        finished
      }, 'sending response');
      reply({
        token: eventToken.code,
        events: events
      });
    }
  }
  _getOrCreateStreamToken(token, context, filterBy, filterValue) {
    return this._getChannel().then((channel) => {
      //get the token if it exists
      this._logger.debug({
        application: context.application._id,
        token
      }, 'loading token');
      return EventToken.findOneAsync({
        application: context.application._id,
        environment: context.environment,
        code: token
      }).then((eventToken) => {
        if (!eventToken) {
          this._logger.debug({
            application: context.application._id,
            token
          }, 'no token found');
          return null;
        }
        //check the queue exists
        this._logger.debug({
          application: context.application._id,
          token
        }, 'checking for stream queue');
        return channel.checkQueue(`${eventToken.code}_stream`).then(() => {
          this._logger.debug({
            application: context.application._id,
            token
          }, 'stream queue exists');
          return eventToken;
        }).catch(() => {
          this._logger.debug({
            application: context.application._id,
            token
          }, 'stream queue non existant');
          //we have to reinitialize the connection here
          return this._getChannel().then((ch) => {
            //force token to recreate
            channel = ch;
            return null;
          });
        });
      }).then((eventToken) => {
        //if either of these dont exist create a token and queue
        if (!eventToken) {
          this._logger.debug('creating new token');
          return new EventToken({
            application: context.application._id,
            environment: context.environment
          }).saveAsync().then((result) => {
            eventToken = result;
            this._logger.debug({
              token: eventToken.code,
              application: context.application._id
            }, 'created new token');
            this._logger.debug({
              token: eventToken.code,
              application: context.application._id
            }, 'creating queue');
            return channel.assertQueue(`${eventToken.code}_stream`, {
              durable: true,
              //expire in an hour of not checking
              expires: 3600000
            }).then(() => {
              let eventNamePattern = '*';
              let correlationIdPattern = '*';
              if (filterBy === 'eventName') {
                eventNamePattern = filterValue;
              }
              if (filterBy === 'correlationId') {
                correlationIdPattern = '*';
              }
              let pattern = `event.${context.application._id}.${eventNamePattern}.${correlationIdPattern}`;
              return channel.assertExchange('hoist', 'topic').then(() => {
                return channel.bindQueue(`${eventToken.code}_stream`, `hoist`, pattern)
                  .then(() => {
                    this._logger.debug({
                      token: eventToken.code,
                      application: context.application._id
                    }, 'queue created');
                    return eventToken;
                  });
              });

            });
          });
        } else {
          return eventToken;
        }
      }).then((eventToken) => {
        channel.connection.close();
        return eventToken;
      });
    });
  }

  /**
   * map routes for this controller
   * @param {HapiServer} server - the Hapi Server instance
   */
  mapRoutes(server) {
    this._logger.debug('mapping server routes');
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
      // GET /event/payload/{id}
      path: routePrefix + '/payload/{id}',
      method: ['GET'],
      handler: this.getEventPayload,
      config: {
        auth: 'hoist',
        bind: this
      }
    }, {
      // GET /event/{id}
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

export
default EventController;
