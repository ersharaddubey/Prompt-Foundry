const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withAndroidManifest,
  withSettingsGradle,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const APPALOO_MAVEN = 'https://download.appaloo.io/appaloo-sdk/android';
const APPALOO_DEP = 'io.appaloo:sdk:1.0.3';

/**
 * Modern Expo uses settings.gradle with dependencyResolutionManagement
 */
function withAppalooSettings(config) {
  return withSettingsGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(APPALOO_MAVEN)) {
      // Insert inside the repositories block of dependencyResolutionManagement
      if (contents.includes('dependencyResolutionManagement')) {
        contents = contents.replace(
          /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
          `$1
        maven { url = uri("${APPALOO_MAVEN}") }`
        );
      } else if (contents.includes('repositories {')) {
        contents = contents.replace(
          /repositories\s*\{/,
          `repositories {
        maven { url = uri("${APPALOO_MAVEN}") }`
        );
      } else {
        // Fallback: append at the end
        contents += `
dependencyResolutionManagement {
  repositories {
    maven { url = uri("${APPALOO_MAVEN}") }
  }
}
`;
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Older project-level build.gradle style
 */
function withAppalooProjectBuild(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(APPALOO_MAVEN) && contents.includes('allprojects')) {
      contents = contents.replace(
        /(allprojects\s*\{[\s\S]*?repositories\s*\{)/,
        `$1
        maven { url '${APPALOO_MAVEN}' }`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Adds the implementation line to app/build.gradle
 */
function withAppalooDependency(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(APPALOO_DEP)) {
      if (contents.includes('dependencies {')) {
        contents = contents.replace(
          /dependencies\s*\{/,
          `dependencies {
    implementation("${APPALOO_DEP}")`
        );
      } else {
        contents += `\n\ndependencies {\n    implementation("${APPALOO_DEP}")\n}\n`;
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Ensures INTERNET permission
 */
function withAppalooPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const hasInternet = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.INTERNET'
    );

    if (!hasInternet) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.INTERNET' },
      });
    }

    return config;
  });
}

const withAppaloo = (config) => {
  config = withAppalooSettings(config);
  config = withAppalooProjectBuild(config);
  config = withAppalooDependency(config);
  config = withAppalooPermissions(config);
  return config;
};

module.exports = createRunOncePlugin(withAppaloo, 'withAppaloo', '1.0.0');
