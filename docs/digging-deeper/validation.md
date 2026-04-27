# Validation

FaberJS validation mirrors Laravel's rule engine. Rules are declarative strings (`'required|string|min:3'`) or rule objects for complex cases. The preferred approach is `FormRequest` — a dedicated class that encapsulates rules and authorization.

## Using `FormRequest`

Generate a form request:

```bash
# No dedicated generator yet — create the file manually:
# app/requests/CreateUserRequest.ts
```

```typescript
import { FormRequest } from '@faber-js/validation';
import type { ValidationRules } from '@faber-js/validation';

export class CreateUserRequest extends FormRequest {
  rules(): ValidationRules {
    return {
      name: 'required|string|min:2|max:100',
      email: 'required|email',
      password: 'required|string|min:8|confirmed',
      role: 'required|in:user,editor,admin',
    };
  }
}
```

Use it in a controller:

```typescript
async store(req: Request): Promise<Response> {
  const form = new CreateUserRequest(req);
  const data = await form.validate();
  // data is typed as InputData (Record<string, unknown>)
  // If validation fails, a 422 ValidationException is thrown automatically

  const user = await this.userService.create(data);
  return this.json({ data: user }, 201);
}
```

When validation fails, the `HttpKernel` converts the `ValidationException` into a `422` response:

```json
{
  "message": "Validation failed.",
  "errors": {
    "email": ["The email must be a valid email address."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

## Authorization in `FormRequest`

Override `authorize()` to gate the request. Return `false` to throw a `403 ForbiddenException`:

```typescript
export class UpdatePostRequest extends FormRequest {
  override authorize(): boolean {
    const user = this.user();
    const postUserId = this.input('user_id');
    return user?.id === postUserId;
  }

  rules(): ValidationRules {
    return {
      title: 'required|string|max:255',
      body: 'required|string',
    };
  }
}
```

## Available rules

Rules are pipe-separated strings. Each rule may optionally take a parameter after a colon.

| Rule               | Example                    | Description                                            |
| ------------------ | -------------------------- | ------------------------------------------------------ |
| `required`         | `'required'`               | Field must be present and non-empty                    |
| `string`           | `'string'`                 | Value must be a string                                 |
| `integer`          | `'integer'`                | Value must be an integer                               |
| `numeric`          | `'numeric'`                | Value must be a number                                 |
| `boolean`          | `'boolean'`                | Value must be boolean-like (`true`, `false`, `1`, `0`) |
| `array`            | `'array'`                  | Value must be an array                                 |
| `email`            | `'email'`                  | Value must be a valid email address                    |
| `url`              | `'url'`                    | Value must be a valid URL                              |
| `nullable`         | `'nullable'`               | Value may be `null` — stops further rules if null      |
| `min:n`            | `'min:8'`                  | String min length or number min value                  |
| `max:n`            | `'max:255'`                | String max length or number max value                  |
| `in:a,b,c`         | `'in:user,admin'`          | Value must be one of the listed values                 |
| `not_in:a,b`       | `'not_in:root,guest'`      | Value must not be one of the listed values             |
| `confirmed`        | `'confirmed'`              | Value must match `{field}_confirmation` in the input   |
| `same:other`       | `'same:password'`          | Value must equal the named field                       |
| `different:other`  | `'different:old_password'` | Value must differ from the named field                 |
| `unique:table,col` | `'unique:users,email'`     | Value must not exist in the given table column         |
| `regex:pattern`    | `'regex:^[A-Z]+'`          | Value must match the regex                             |

## Rule arrays

Instead of a pipe string, supply an array. Mix string rules and rule objects:

```typescript
import { Rule } from '@faber-js/validation';

rules(): ValidationRules {
  return {
    email: ['required', 'email', Rule.unique('users', 'email')],
    slug: ['required', 'string', Rule.regex(/^[a-z0-9-]+$/)],
    status: ['required', Rule.in('draft', 'published', 'archived')],
  };
}
```

## Rule objects

### `Rule.unique(table, column)`

Checks that the value does not already exist in the database.

```typescript
import { Rule } from '@faber-js/validation';

rules(): ValidationRules {
  return {
    email: ['required', 'email', Rule.unique('users', 'email')],
  };
}
```

Ignore a specific row (for update requests):

```typescript
rules(): ValidationRules {
  const userId = this.param('id');
  return {
    email: ['required', 'email', Rule.unique('users', 'email').ignore(userId)],
  };
}
```

### `Rule.regex(pattern)`

```typescript
rules(): ValidationRules {
  return {
    phone: ['required', Rule.regex(/^\+?[0-9]{10,15}$/)],
  };
}
```

### `Rule.in(...values)`

```typescript
rules(): ValidationRules {
  return {
    color: ['required', Rule.in('red', 'green', 'blue')],
  };
}
```

## Manual validation

Use `Validator` directly when you do not want a `FormRequest`:

```typescript
import { Validator } from '@faber-js/validation';

const data = { name: 'Alice', email: 'not-an-email' };

const validator = new Validator(data, {
  name: 'required|string',
  email: 'required|email',
});

const result = await validator.validate();

if (!result.passes) {
  console.log(result.errors);
  // { email: ['The email must be a valid email address.'] }
}
```

## The `validate` helper

For one-liners, use the `validate()` standalone function:

```typescript
import { validate } from '@faber-js/validation';

const result = await validate(req.all(), {
  name: 'required|string',
  email: 'required|email',
});
```
