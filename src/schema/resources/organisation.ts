import { z } from 'zod';
import { record } from '../../lib/zod.ts';

const organisation = /* surrealql */ `
    DEFINE TABLE organisation SCHEMAFULL
        PERMISSIONS
            FOR create WHERE $scope IN ['admin', 'user']
            FOR select WHERE 
                $scope = 'admin' OR 
                ($scope = 'user' && managers.*.id CONTAINS $auth.id)
            FOR update WHERE 
                $scope = 'admin' OR 
                ($scope = 'user' && managers[WHERE role IN ["owner", "adminstrator"]].id CONTAINS $auth.id)
            FOR delete WHERE 
                $scope = 'admin' OR 
                ($scope = 'user' && managers[WHERE role IN ["owner", "adminstrator"] AND org != NONE].id CONTAINS $auth.id);

    DEFINE FIELD name                 ON organisation TYPE string;
    DEFINE FIELD description          ON organisation TYPE option<string>;
    DEFINE FIELD website              ON organisation TYPE option<string>;
    DEFINE FIELD email                ON organisation TYPE string           
        ASSERT string::is::email($value);
    DEFINE FIELD type                 ON organisation VALUE meta::tb(id);

    DEFINE FIELD logo                 ON organisation TYPE option<string>
        PERMISSIONS
            FOR update WHERE $scope = 'admin';
    DEFINE FIELD banner               ON organisation TYPE option<string>
        PERMISSIONS
            FOR update WHERE $scope = 'admin';
    DEFINE FIELD slug                 ON organisation TYPE string
        VALUE 
            IF $value == NONE THEN
                RETURN meta::id(id);
            ELSE IF not($value) THEN
                RETURN $before ?? meta::id(id);
            ELSE IF $scope = 'admin' OR not($scope) THEN
                RETURN $value;
            ELSE IF tier IN ["business", "enterprise"] THEN
                RETURN $value;
            ELSE
                RETURN meta::id(id);
            END
        DEFAULT meta::id(id);

    DEFINE FIELD tier                 ON organisation TYPE string
        ASSERT $value IN ["free", "basic", "business", "enterprise"]
        DEFAULT "free"
        PERMISSIONS 
            FOR create, update WHERE
                $scope = 'admin';

    -- ABOUT RECURSIVE NESTING OF ORGANISATIONS
    -- Tested it, utter limit is 16 levels of recursion which is overkill for this scenario :)
    -- There is no usecase for this, nobody will reach this limit
    -- If they do, they break their own management interface.
    -- It will still work fine for admins because they don't have a subquery in the permission clause :)

    DEFINE FIELD part_of              ON organisation TYPE option<record<organisation>>
        VALUE
            IF $scope = 'admin' OR not($scope) THEN
                $value ?? $before
            ELSE IF (SELECT VALUE id FROM $value WHERE managers[WHERE role IN ["owner", "adminstrator"]].id CONTAINS $auth.id)[0] THEN
                $value ?? $before
            ELSE 
                $before
            END
        PERMISSIONS
            FOR update WHERE
                $scope = 'admin';

    DEFINE FIELD managers             ON organisation
        VALUE <future> {
            -- Find all confirmed managers of this org
            LET $local = SELECT VALUE <-manages[?confirmed] FROM ONLY $parent.id;
            -- Grab the role and user ID
            LET $local = SELECT role, in AS user FROM $local;

            LET $part_of = type::thing(part_of);
            -- Select all managers from the org we are a part of, if any
            LET $inherited = (SELECT VALUE managers FROM ONLY $part_of) ?? [];
            -- Add an org field describing from which org these members are inherited, if not already inherited before
            LET $inherited = SELECT *, type::thing('puborg', org OR $part_of) AS org FROM $inherited;

            -- Return the combined result
            RETURN array::concat($local, $inherited);
        };

    DEFINE FIELD created              ON organisation TYPE datetime VALUE $before OR time::now()    DEFAULT time::now();
    DEFINE FIELD updated              ON organisation TYPE datetime VALUE time::now()               DEFAULT time::now();
`;

export const Organisation = z.object({
    id: record('organisation'),
    name: z.string(),
    description: z.string().optional(),
    website: z.string().url().optional(),
    email: z.string().email(),
    type: z.literal('organisation'),
    logo: z.string().optional(),
    banner: z.string().optional(),
    slug: z.string(),
    tier: z.union([
        z.literal('free'),
        z.literal('basic'),
        z.literal('business'),
        z.literal('enterprise'),
    ]),
    part_of: record('organisation').optional(),
    managers: z.array(
        z.object({
            user: record('manager'),
            role: z.union([
                z.literal('owner'),
                z.literal('administrator'),
                z.literal('event_manager'),
                z.literal('event_viewer'),
            ]),
            org: record('puborg').optional(),
        })
    ),
    created: z.coerce.date(),
    updated: z.coerce.date(),
});

export type Organisation = z.infer<typeof Organisation>;

/* Events */

const organisation_create = /* surrealql */ `
    DEFINE EVENT organisation_create ON organisation WHEN $event == "CREATE" THEN {
        CREATE log CONTENT {
            record: $after.id,
            event: $event
        };
    };
`;

const organisation_delete = /* surrealql */ `
    DEFINE EVENT organisation_delete ON organisation WHEN $event == "DELETE" THEN {
        CREATE log CONTENT {
            record: $before.id,
            event: $event
        };
    };
`;

const organisation_update = /* surrealql */ `
    DEFINE EVENT organisation_update ON organisation WHEN $event == "UPDATE" THEN {
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

        IF $before.description != $after.description THEN
            CREATE log CONTENT {
                record: $after.id,
                event: $event,
                change: {
                    field: "description",
                    value: { before: $before.description, after: $after.description }
                }
            }
        END;

        IF $before.website != $after.website THEN
            CREATE log CONTENT {
                record: $after.id,
                event: $event,
                change: {
                    field: "website",
                    value: { before: $before.website, after: $after.website }
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
    };
`;

export default [
    organisation,
    organisation_create,
    organisation_delete,
    organisation_update,
].join('\n\n');
