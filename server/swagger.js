// scripts/generate-swagger.js
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

function extractRoutes(content, file) {
  const routes = [];
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      method: match[1],
      path: match[2],
      file: path.basename(file, '.js'),
    });
  }
  return routes;
}

function generateSwaggerSpec(routes) {
  const paths = {};
  const tags = new Set();

  routes.forEach(route => {
    if (!paths[route.path]) paths[route.path] = {};

    const pathParts = route.file.split('/');
    const tag = pathParts[pathParts.length - 1] || 'default';
    tags.add(tag);

    paths[route.path][route.method] = {
      tags: [tag],
      summary: `${route.method.toUpperCase()} ${route.path}`,
      security: [{ bearerAuth: [] }], // Add this
      responses: {
        200: { description: 'Success' },
      },
    };

    if (['post', 'put', 'patch'].includes(route.method)) {
      paths[route.path][route.method].requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      };
    }
  });

  return {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Auto-generated from Express routes',
    },
    tags: Array.from(tags)
      .sort((a, b) => {
        if (a === 'auth') return -1;
        if (b === 'auth') return 1;
        return a.localeCompare(b);
      })
      .map(tag => ({ name: tag })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths,
  };
}

async function main() {
  const rootDir = path.resolve(__dirname);

  const routeFiles = await glob(`${rootDir}/routes/*.js`);
  const controllerFiles = await glob(`${rootDir}/controllers/*.js`);
  const files = [...routeFiles, ...controllerFiles];

  let allRoutes = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    allRoutes = allRoutes.concat(extractRoutes(content, file));
  }

  allRoutes = allRoutes.map(route => {
    const fileName = path.basename(route.file);
    if (fileName === 'auth') {
      return { ...route, path: `/api/auth${route.path === '/' ? '' : route.path}` };
    } else if (fileName === 'users') {
      return { ...route, path: `/api/users${route.path === '/' ? '' : route.path}` };
    } else if (fileName === 'jobs') {
      return { ...route, path: `/api/jobs${route.path === '/' ? '' : route.path}` };
    } else if (fileName === 'contracts') {
      return { ...route, path: `/api/contracts${route.path === '/' ? '' : route.path}` };
    }
    return route;
  });

  const spec = generateSwaggerSpec(allRoutes);

  fs.writeFileSync(path.join(__dirname, 'docs', 'swagger.json'), JSON.stringify(spec, null, 2));
  console.log(`✓ Generated docs for ${allRoutes.length} routes`);
}

main();
