import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../lib/prisma.js', import.meta.url),'utf8').replace(/^import[^\n]*\r?\n/gm,'').replace('export const db','const db');
test('Prisma cache reuses the current generated client and replaces an outdated one',()=>{
 let created=0;
 class CurrentClient { constructor(){created++} }
 const cached={old:true};
 const state={prisma:cached,prismaConstructor:class OldClient {}};
 const deps={globalThis:state,PrismaClient:CurrentClient,Pool:class {},PrismaPg:class {},process:{env:{NODE_ENV:'development'}}};
 const first=runInNewContext(`${source}; db`,{...deps});
 assert.notEqual(first,cached);assert.equal(created,1);
 const second=runInNewContext(`${source}; db`,{...deps});
 assert.equal(first,second);assert.equal(created,1);
});
