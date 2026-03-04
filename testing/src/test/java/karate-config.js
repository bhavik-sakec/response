function fn() {
  var env = karate.env; // get system property 'karate.env'
  karate.log('karate.env system property was:', env);

  if (!env) {
    env = 'dev';
  }

  var config = {
    env: env,
    baseUrl: 'http://localhost:8080',
    connectTimeout: 10000,
    readTimeout: 15000
  };

  if (env === 'dev') {
    config.baseUrl = 'http://localhost:8080';
  } else if (env === 'staging') {
    config.baseUrl = 'http://staging.example.com';
  } else if (env === 'prod') {
    config.baseUrl = 'https://api.example.com';
  }

  karate.configure('headers', { 'Accept': 'application/json' });
  karate.configure('connectTimeout', config.connectTimeout);
  karate.configure('readTimeout', config.readTimeout);

  return config;
}
