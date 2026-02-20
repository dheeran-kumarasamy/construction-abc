# Code Citations

## License: unknown
https://github.com/v-20-p/deploy_reactApp-expressJs/blob/b8f068da6fee9d9b4e4bc3ef7c1a7894048d4bba/README.md

```
Please share the following so I can diagnose the exact issue:

1. **Vercel Runtime/Function Logs** (not build logs):
   - Go to Vercel Dashboard → Your Project → **Deployments** → Click latest deployment → **Functions** tab → Check logs

2. **Your `src/app.ts`** file content

3. **Your `backend/package.json`** file content

---

In the meantime, here are some additional things to check:

### 1. **Check `tsconfig.json`**
Make sure your `tsconfig.json` includes the `api/` directory:
```json
{
  "compilerOptions": {
    "rootDir": ".",  // not "src"
    "outDir": "dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

### 2. **Check `vercel.json` Root Directory**
If your `backend/` is a subdirectory in your repo, make sure you set the **Root Directory** to `backend` in:
- Vercel Dashboard → Your Project → **Settings** → **General** → **Root Directory** → Set to `backend`

### 3. **Add `outputDirectory` to `vercel.json`**
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
```


## License: unknown
https://github.com/v-20-p/deploy_reactApp-expressJs/blob/b8f068da6fee9d9b4e4bc3ef7c1a7894048d4bba/README.md

```
Please share the following so I can diagnose the exact issue:

1. **Vercel Runtime/Function Logs** (not build logs):
   - Go to Vercel Dashboard → Your Project → **Deployments** → Click latest deployment → **Functions** tab → Check logs

2. **Your `src/app.ts`** file content

3. **Your `backend/package.json`** file content

---

In the meantime, here are some additional things to check:

### 1. **Check `tsconfig.json`**
Make sure your `tsconfig.json` includes the `api/` directory:
```json
{
  "compilerOptions": {
    "rootDir": ".",  // not "src"
    "outDir": "dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

### 2. **Check `vercel.json` Root Directory**
If your `backend/` is a subdirectory in your repo, make sure you set the **Root Directory** to `backend` in:
- Vercel Dashboard → Your Project → **Settings** → **General** → **Root Directory** → Set to `backend`

### 3. **Add `outputDirectory` to `vercel.json`**
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
```


## License: unknown
https://github.com/v-20-p/deploy_reactApp-expressJs/blob/b8f068da6fee9d9b4e4bc3ef7c1a7894048d4bba/README.md

```
Please share the following so I can diagnose the exact issue:

1. **Vercel Runtime/Function Logs** (not build logs):
   - Go to Vercel Dashboard → Your Project → **Deployments** → Click latest deployment → **Functions** tab → Check logs

2. **Your `src/app.ts`** file content

3. **Your `backend/package.json`** file content

---

In the meantime, here are some additional things to check:

### 1. **Check `tsconfig.json`**
Make sure your `tsconfig.json` includes the `api/` directory:
```json
{
  "compilerOptions": {
    "rootDir": ".",  // not "src"
    "outDir": "dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

### 2. **Check `vercel.json` Root Directory**
If your `backend/` is a subdirectory in your repo, make sure you set the **Root Directory** to `backend` in:
- Vercel Dashboard → Your Project → **Settings** → **General** → **Root Directory** → Set to `backend`

### 3. **Add `outputDirectory` to `vercel.json`**
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
```


## License: unknown
https://github.com/v-20-p/deploy_reactApp-expressJs/blob/b8f068da6fee9d9b4e4bc3ef7c1a7894048d4bba/README.md

```
Please share the following so I can diagnose the exact issue:

1. **Vercel Runtime/Function Logs** (not build logs):
   - Go to Vercel Dashboard → Your Project → **Deployments** → Click latest deployment → **Functions** tab → Check logs

2. **Your `src/app.ts`** file content

3. **Your `backend/package.json`** file content

---

In the meantime, here are some additional things to check:

### 1. **Check `tsconfig.json`**
Make sure your `tsconfig.json` includes the `api/` directory:
```json
{
  "compilerOptions": {
    "rootDir": ".",  // not "src"
    "outDir": "dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

### 2. **Check `vercel.json` Root Directory**
If your `backend/` is a subdirectory in your repo, make sure you set the **Root Directory** to `backend` in:
- Vercel Dashboard → Your Project → **Settings** → **General** → **Root Directory** → Set to `backend`

### 3. **Add `outputDirectory` to `vercel.json`**
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
```


## License: unknown
https://github.com/v-20-p/deploy_reactApp-expressJs/blob/b8f068da6fee9d9b4e4bc3ef7c1a7894048d4bba/README.md

```
Please share the following so I can diagnose the exact issue:

1. **Vercel Runtime/Function Logs** (not build logs):
   - Go to Vercel Dashboard → Your Project → **Deployments** → Click latest deployment → **Functions** tab → Check logs

2. **Your `src/app.ts`** file content

3. **Your `backend/package.json`** file content

---

In the meantime, here are some additional things to check:

### 1. **Check `tsconfig.json`**
Make sure your `tsconfig.json` includes the `api/` directory:
```json
{
  "compilerOptions": {
    "rootDir": ".",  // not "src"
    "outDir": "dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

### 2. **Check `vercel.json` Root Directory**
If your `backend/` is a subdirectory in your repo, make sure you set the **Root Directory** to `backend` in:
- Vercel Dashboard → Your Project → **Settings** → **General** → **Root Directory** → Set to `backend`

### 3. **Add `outputDirectory` to `vercel.json`**
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
```


## License: unknown
https://github.com/v-20-p/deploy_reactApp-expressJs/blob/b8f068da6fee9d9b4e4bc3ef7c1a7894048d4bba/README.md

```
Please share the following so I can diagnose the exact issue:

1. **Vercel Runtime/Function Logs** (not build logs):
   - Go to Vercel Dashboard → Your Project → **Deployments** → Click latest deployment → **Functions** tab → Check logs

2. **Your `src/app.ts`** file content

3. **Your `backend/package.json`** file content

---

In the meantime, here are some additional things to check:

### 1. **Check `tsconfig.json`**
Make sure your `tsconfig.json` includes the `api/` directory:
```json
{
  "compilerOptions": {
    "rootDir": ".",  // not "src"
    "outDir": "dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

### 2. **Check `vercel.json` Root Directory**
If your `backend/` is a subdirectory in your repo, make sure you set the **Root Directory** to `backend` in:
- Vercel Dashboard → Your Project → **Settings** → **General** → **Root Directory** → Set to `backend`

### 3. **Add `outputDirectory` to `vercel.json`**
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
```

