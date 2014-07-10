// Batch find for Ember Data. It will coerce all the finds on the same run loop
// and execute a single batch find for all the records. It mimics the find
// semantics.
//
// Example usage:
//
//     var user1 = store.batchFind('user', 1);
//     var user2 = store.batchFind('user', 2);
//
//     user1.then(function(user) {
//       console.log(user1.get('firstName'));
//     });
//
//     user2.then(function(user) {
//       console.log(user2.get('firstName');
//       // circumstancially, this will be available as well:
//       console.log(user1.get('firstName');
//     });
//
(function(exports) {
  var findQueues = {};

  var FindPromise = DS.PromiseObject;
  var Promise = Em.RSVP.Promise;

  var findMany = function(store, type, ids) {
    return new Promise(function(resolve) {
      store.find(type, {
        ids: ids
      }).then(resolve);
    });
  };

  var batchFind = function(type, id) {
    var store = this;
    var promise = new Promise(function(resolve) {
      var cachedModel = store.getById(type, id);
      if (cachedModel) {
        Ember.run.scheduleOnce('afterRender', store, function() {
          resolve(cachedModel);
        });
      } else {
        if (!findQueues[type]) findQueues[type] = {};
        if (!findQueues[type][id]) findQueues[type][id] = [];
        findQueues[type][id].push(resolve);

        Ember.run.scheduleOnce('afterRender', store, flushFindQueues);
      }
    });

    return FindPromise.create({
      content: Ember.Object.create({
        id: id
      }),
      promise: promise
    });
  };

  var resolvePromises = function(promisesToResolve, resolver) {
    promisesToResolve.forEach(function(resolveFunc) {
      resolveFunc(resolver);
    });
  };

  var flushQueue = function(store, key, tasks) {
    var ids = Object.keys(tasks);
    var resolveFunc, record, id;

    findMany(store, key, ids).then(function() {
      for (var task in tasks) {
        if (tasks.hasOwnProperty(task)) {
          id = task;
          record = store.getById(key, id);

          resolvePromises(tasks[task], record);

        }
      }
    });

    findQueues[key] = [];
  };

  var flushFindQueues = function() {
    var store = this;

    for (var key in findQueues) {
      if (findQueues.hasOwnProperty(key)) {
        var tasks = findQueues[key];
        flushQueue(store, key, tasks);
        findQueues[key] = [];
      }
    }
  };

  exports.batchFind = batchFind;
})(window);