import { z } from 'zod';
import { fullname, record } from '../lib/zod.ts';

const user = /* surrealql */ `
    DEFINE TABLE user SCHEMAFULL 
        PERMISSIONS 
            FOR select, update, delete WHERE 
                $scope = 'admin' OR
                (
                    $scope = 'user' && (
                        id = $auth.id OR
                        (SELECT VALUE id FROM organisation WHERE [$parent.id, $auth.id] ALLINSIDE managers.*.id)[0]
                    )
                )
            FOR create WHERE $scope = 'admin'
    ;

    DEFINE FIELD name               ON user TYPE string ASSERT array::len(string::words($value)) > 1;
    DEFINE FIELD email              ON user TYPE string ASSERT is::email($value);
    DEFINE FIELD type               ON user VALUE meta::tb(id);

    DEFINE FIELD profile_picture    ON user TYPE option<string>
        PERMISSIONS
            FOR update WHERE $scope = 'admin';
            
    DEFINE FIELD created            ON user TYPE datetime VALUE $before OR time::now();
    DEFINE FIELD updated            ON user TYPE datetime VALUE time::now();

    DEFINE INDEX email              ON user COLUMNS email UNIQUE;
`;

export const User = z.object({
    id: record('user'),
    name: fullname(),
    email: z.string().email(),
    type: z.literal('user'),
    profile_picture: z.string().optional(),
    created: z.coerce.date(),
    updated: z.coerce.date(),
});

export type User = z.infer<typeof User>;

/* Events */

const user_create = /* surrealql */ `
    DEFINE EVENT user_create ON user WHEN $event == "CREATE" THEN {
        CREATE log CONTENT {
            record: $after.id,
            event: $event
        };
    };
`;

const user_delete = /* surrealql */ `
    DEFINE EVENT user_delete ON user WHEN $event == "DELETE" THEN {
        CREATE log CONTENT {
            record: $before.id,
            event: $event
        };
    };
`;

const user_update = /* surrealql */ `
    DEFINE EVENT user_update ON user WHEN $event == "UPDATE" THEN {
        IF $before.name != $after.name THEN
            CREATE log CONTENT {
                record: $after.id,
                event: $event,
                change: {
                    field: "name",
                    value: { before: $before.name, after: $after.name }
                }
            }
        END;

        IF $before.email != $after.email THEN
            CREATE log CONTENT {
                record: $after.id,
                event: $event,
                change: {
                    field: "email",
                    value: { before: $before.email, after: $after.email }
                }
            }
        END;

        IF $before.profile_picture != $after.profile_picture THEN
            CREATE log CONTENT {
                record: $after.id,
                event: $event,
                change: {
                    field: "profile_picture",
                    value: { before: $before.profile_picture, after: $after.profile_picture }
                }
            }
        END;
    };
`;

export default [user, user_create, user_delete, user_update].join('\n\n');
