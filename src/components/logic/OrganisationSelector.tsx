'use client';

import { SurrealInstance as surreal } from '@/lib/Surreal';
import { Organisation } from '@/schema/resources/organisation';
import { useQuery } from '@tanstack/react-query';
import React, {
    Dispatch,
    ReactNode,
    SetStateAction,
    useEffect,
    useState,
} from 'react';
import { Profile } from '../cards/profile';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function useOrganisationSelector() {
    return useState<Organisation['id']>();
}

export function OrganisationSelector({
    organisation,
    setOrganisation,
    label,
    placeholder,
    autoFocus,
    autoComplete,
    children,
}: {
    organisation?: Organisation['id'];
    setOrganisation: Dispatch<SetStateAction<Organisation['id'] | undefined>>;
    label?: string;
    placeholder?: string;
    autoFocus?: boolean;
    autoComplete?: string;
    children?: ReactNode;
}) {
    const [input, setInput] = useState('');
    const [matches, setMatches] = useState<Organisation[]>([]);
    const { data: profile } = useQuery({
        queryKey: ['organisation', organisation],
        async queryFn() {
            if (!organisation) return null;
            const [res] = await surreal.select<Organisation>(organisation);
            return res ?? null;
        },
    });

    useEffect(() => {
        const timeOutId = setTimeout(() => {
            surreal
                .query<[Organisation[]]>(
                    /* surql */ `
                        SELECT * FROM organisation 
                            WHERE $input
                            AND (
                                email ~ $input
                                OR name ~ $input
                            );
                    `,
                    { input }
                )
                .then(([{ result }]) => {
                    setMatches(result ?? []);
                });
        }, 500);

        return () => clearTimeout(timeOutId);
    }, [input]);

    useEffect(() => {
        if (organisation && input) setInput('');
    }, [organisation, input, setInput]);

    return (
        <div className="space-y-3">
            <Label htmlFor="input">{label ?? 'Name or Email'}</Label>
            {organisation ? (
                <div className="flex items-center justify-between rounded-md border px-4 py-2">
                    <Profile profile={profile || undefined} size="tiny" />
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setOrganisation(undefined)}
                    >
                        Clear
                    </Button>
                </div>
            ) : (
                <>
                    <Input
                        id="input"
                        placeholder={placeholder ?? 'john@doe.org'}
                        value={input}
                        onInput={(e) => setInput(e.currentTarget.value)}
                        autoFocus={autoFocus}
                        autoComplete={autoComplete}
                    />
                    {matches && (
                        <div>
                            {matches.map((organisation) => (
                                <div
                                    key={organisation.id}
                                    className="flex items-center justify-between py-2"
                                >
                                    <Profile
                                        profile={organisation}
                                        size="small"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() =>
                                            setOrganisation(organisation.id)
                                        }
                                    >
                                        {children ?? 'Select'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
