import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportJsonSchemas } from '@global-travel-plans/data-schema';
import { TravelTimeMatrixSchema } from '@global-travel-plans/data-schema/travel-time';
import { z } from 'zod';

const outputDirectory = path.resolve('.generated/json-schema');
await mkdir(outputDirectory, { recursive: true });

const schemas = {
  ...exportJsonSchemas(),
  travelTimeMatrix: z.toJSONSchema(TravelTimeMatrixSchema),
};

await Promise.all(
  Object.entries(schemas).map(async ([name, schema]) => {
    const outputPath = path.join(outputDirectory, `${name}.schema.json`);
    await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  }),
);

console.log(`Generated ${Object.keys(schemas).length} JSON Schemas in ${outputDirectory}`);
