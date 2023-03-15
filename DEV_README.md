# Dev tips

## Publish npm

```sh
deno task build 0.0.3
npm publish dist/
rm dist/
```

## Test

```sh
deno task test
```

If this gives you trouble make sure you deleted the output directory of the
build task.
