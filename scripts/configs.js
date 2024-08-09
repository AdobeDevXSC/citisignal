const ALLOWED_CONFIGS = ['prod', 'stage', 'dev'];

/**
 * This function calculates the environment in which the site is running based on the URL.
 * It defaults to 'prod'. In non 'prod' environments, the value can be overwritten using
 * the 'environment' key in sessionStorage.
 *
 * @returns {string} - environment identifier (dev, stage or prod'.
 */
export const calcEnvironment = () => {
  const { href } = window.location;
  let environment = 'prod';
  if (href.includes('.hlx.page')) {
    environment = 'stage';
  }
  if (href.includes('localhost')) {
    environment = 'dev';
  }

  const environmentFromConfig = window.sessionStorage.getItem('environment');
  if (environmentFromConfig && ALLOWED_CONFIGS.includes(environmentFromConfig) && environment !== 'prod') {
    return environmentFromConfig;
  }

  return environment;
};

function buildConfigURL(environment) {
  const env = environment || calcEnvironment();
  // let fileName = 'configs.json?sheet=prod';
  let fileName = 'configs.json';
  if (env !== 'prod') {
    fileName = `configs-${env}.json`;
  }
  const configURL = new URL(`${window.location.origin}/${fileName}`);
  /* eslint-disable-next-line no-use-before-define */
  if (getAemAuthorEnv()) {
    const aemContentPath = getAemContentPath();
    return new URL(`${window.location.origin}${aemContentPath}/${fileName}`);
  }
  return configURL;
}

function getAemContentPath() {
  let authorContentPath = '/content';
  if (window.hlx && window.hlx.codeBasePath) {
    /* eslint-disable-next-line prefer-destructuring */
    authorContentPath = window.hlx.codeBasePath.match(/^[^.]+/)[0];
    /* eslint-disable-next-line no-console */
    console.log(`In configs.js, is in AEM author env, so determine content path via hlx: ${authorContentPath}`);
  } else if (window.location && window.location.pathname) {
    let pathComponents = window.location.pathname.split('/');
    pathComponents = pathComponents.filter((component) => component !== '');
    const firstTwoElements = pathComponents.slice(0, 2).join('/');
    authorContentPath = `/${firstTwoElements}`;
    /* eslint-disable-next-line no-console */
    console.log(`In configs.js, is in AEM author env, so determine content path via location: ${authorContentPath}`);
  }
  return authorContentPath;
}

const getConfigForEnvironment = async (environment) => {
  const env = environment || calcEnvironment();
  let configJSON = window.sessionStorage.getItem(`config:${env}`);
  if (!configJSON) {
    configJSON = await fetch(buildConfigURL(env));
    if (!configJSON.ok) {
      throw new Error(`Failed to fetch config for ${env}`);
    }
    configJSON = await configJSON.text();
    window.sessionStorage.setItem(`config:${env}`, configJSON);
  }
  return configJSON;
};

/**
 * This function retrieves a configuration value for a given environment.
 *
 * @param {string} configParam - The configuration parameter to retrieve.
 * @param {string} [environment] - Optional, overwrite the current environment.
 * @returns {Promise<string|undefined>} - The value of the configuration parameter, or undefined.
 */
export const getConfigValue = async (configParam, environment) => {
  const env = environment || calcEnvironment();
  const configJSON = await getConfigForEnvironment(env);
  const configElements = JSON.parse(configJSON).data;
  return configElements.find((c) => c.key === configParam)?.value;
};

export const getCookie = (cookieName) => {
  const cookies = document.cookie.split(';');
  let foundValue;

  cookies.forEach((cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName) {
      foundValue = decodeURIComponent(value);
    }
  });

  return foundValue;
};

export const getAemAuthorEnv = () => {
  const { href } = window.location;
  const aemEnvReg = /https?:\/\/author-(p\d{3,8})-(e\d{3,8}).+/i;
  const isAemAuthorEnv = aemEnvReg.test(href);
  /* eslint-disable-next-line no-console */
  console.log(`In configs.js, is in AEM author env: ${isAemAuthorEnv}`);
  return isAemAuthorEnv;
};
