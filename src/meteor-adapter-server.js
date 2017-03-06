const extendMethod = (method, AccountsServer) => async(accessToken, ...args) => {
  let user;

  if (accessToken === null) {
    user = null;
  }
  else {
    user = await AccountsServer.resumeSession(accessToken);
  }

  return method.apply(Object.assign({}, this, { user: () => user, userId: () => user.id }), [...(args || [])]);
};

const extendMethodWithFiber = (method, AccountsServer) => {
  return (accessToken, ...args) => {
    let user;

    if (accessToken === null) {
      user = null;
    }
    else {
      const method = Meteor.wrapAsync(function (accessToken, callback) {
        AccountsServer.resumeSession(accessToken)
          .then((user) => {
            callback(null, user);
          })
          .catch((e) => {
            callback(e, null);
          })
      });

      user = method(accessToken);
    }

    return method.apply(Object.assign({}, this, { user: () => user, userId: () => user.id }), [...(args || [])]);
  };
};

const wrapMeteorPublish = (Meteor, AccountsServer) => {
  const originalMeteorPublish = Meteor.publish;

  Meteor.publish = (publicationName, func, ...args) => {
    const newFunc = extendMethodWithFiber(func, AccountsServer);

    return originalMeteorPublish.apply(Meteor, [publicationName, newFunc, ...(args || [])]);
  };
};

const wrapMeteorMethods = (Meteor, AccountsServer) => {
  const originalMeteorMethod = Meteor.methods;

  Meteor.methods = (methodsObject, ...args) => {
    const modifiedArgs = Object.keys(methodsObject).map(methodName => {
      const originalMethod = methodsObject[methodName];

      return {
        name: methodName,
        method: extendMethod(originalMethod, AccountsServer),
      };
    });

    const argsAsObject = modifiedArgs.reduce((a, b) => Object.assign(a, { [b.name]: b.method }), {});

    return originalMeteorMethod.apply(Meteor, [argsAsObject, ...(args || [])]);
  }
};

export const wrapMeteorServer = (Meteor, AccountsServer) => {
  wrapMeteorMethods(Meteor, AccountsServer);
  wrapMeteorPublish(Meteor, AccountsServer);
};
