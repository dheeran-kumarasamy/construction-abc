# Code Citations

## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Jiorel/Admin-Panel/blob/7a797b1ed3a02dba27b5c17381d2387f129bdd0c/src/features/auth/pages/LogIn/LogIn.tsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Ranagithubrr/kuricmt/blob/7930e3568c9125904790e34084e009148a2090bf/src/pages/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/imgeekabhi/next-auth-app/blob/071839b5ff5e1c47594f3c5d22216a292266b8dd/Components/Auth/authForm.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/Techsupport254/agrisolve/blob/7f1a56a79de4cb7830e46bf2f6ec9433e9fc6ba8/src/Components/Login/Login.jsx

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/gautamsharma22/eXploreIndia/blob/8c766a4469e7dc8f6742028fed67d618f62b6b80/frontend/xplore-india/src/Components/Authpages/Login.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```


## License: unknown
https://github.com/Pawank06/blog/blob/1b428452f7628035b56d9e235091d9579b2f5e9c/frontend/src/controllers/users.controllers.js

```
Found the issue. The `RequireAuth` component checks `useAuth()` but the Login page doesn't call `login()` to set the user in the auth context. Login.tsx only stores the token in localStorage but doesn't update the AuthContext.

Update [Login.tsx](frontend/src/pages/Login.tsx#L1-L45) to use the auth context:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store
```

