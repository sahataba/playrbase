'use client';

import { Avatar } from '@/components/cards/avatar';
import { Profile } from '@/components/cards/profile';
import Container from '@/components/layout/Container';
import { NotFoundScreen } from '@/components/layout/NotFoundScreen';
import { UserSelector, useUserSelector } from '@/components/logic/UserSelector';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useSurreal } from '@/lib/Surreal';
import { record } from '@/lib/zod';
import { Link } from '@/locales/navigation';
import { Organisation } from '@/schema/resources/organisation';
import { User, UserAsRelatedUser } from '@/schema/resources/user';
import { DialogClose } from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import _ from 'lodash';
import { ArrowRight, Loader2, Mail, MailX, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import React, { useState } from 'react';
import { z } from 'zod';

export default function Account() {
    const params = useParams();
    const slug = Array.isArray(params.organisation)
        ? params.organisation[0]
        : params.organisation;
    const { isPending, data, refetch } = useData(slug);
    const t = useTranslations('pages.console.organisation.members');

    const organisation = data?.organisation;
    const invited_members = data?.invited_members;

    // Split the managers out per organisation,
    // store managers for the current org under the '__' key
    const perOrg = _.groupBy(
        organisation?.managers,
        ({ org }) => org?.id ?? '__'
    );

    const canDeleteOwner =
        !!organisation &&
        !!(
            organisation.managers.filter(({ role }) => role == 'owner').length >
            1
        );

    return isPending ? (
        <Container className="flex w-full flex-grow items-center justify-center">
            <Loader2 size={50} className="animate-spin" />
        </Container>
    ) : organisation ? (
        <div className="flex flex-grow flex-col pt-6">
            <div className="flex items-center justify-between pb-6">
                <h1 className="text-3xl font-semibold">{t('title')}</h1>
                {organisation.can_manage && (
                    <AddMember
                        organisation={organisation.id}
                        refresh={refetch}
                    />
                )}
            </div>
            <div className="space-y-20">
                {Object.entries(perOrg).map(([key, managers]) => (
                    <ListManagers
                        key={key}
                        managers={managers}
                        invites={key == '__' ? invited_members : []}
                        organisation={managers.find(({ org }) => org)?.org}
                        canManage={organisation.can_manage}
                        canDeleteOwner={canDeleteOwner}
                        refresh={refetch}
                    />
                ))}
            </div>
        </div>
    ) : (
        <NotFoundScreen text={t('not_found')} />
    );
}

function ListManagers({
    organisation,
    managers,
    invites,
    canManage,
    canDeleteOwner,
    refresh,
}: {
    organisation?: Organisation;
    managers: Data['managers'];
    invites?: Invited[];
    canManage: boolean;
    canDeleteOwner?: boolean;
    refresh: () => unknown;
}) {
    const t = useTranslations(
        'pages.console.organisation.members.list_managers'
    );

    return (
        <div>
            {organisation && (
                <h2 className="pb-2 text-2xl font-semibold">
                    {t.rich('title', {
                        org: () => organisation.name,
                    })}
                </h2>
            )}
            <Table>
                <TableCaption>
                    <b>{t('table.caption.count')}:</b>{' '}
                    {managers.length + (invites?.length ?? 0)}
                </TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead />
                        <TableHead>{t('table.columns.name')}</TableHead>
                        <TableHead>{t('table.columns.email')}</TableHead>
                        <TableHead>{t('table.columns.role')}</TableHead>
                        <TableHead align="right" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invites?.map((invite) => (
                        <InvitedManager
                            key={invite.edge}
                            invite={invite}
                            canManage={canManage}
                            refresh={refresh}
                        />
                    ))}
                    {managers.map((manager) => (
                        <ListManager
                            key={manager.edge}
                            manager={manager}
                            canManage={canManage}
                            canDeleteOwner={canDeleteOwner}
                            refresh={refresh}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function ListManager({
    refresh,
    canManage,
    canDeleteOwner,
    manager: {
        user: { id, name, email, profile_picture },
        role,
        org,
        edge,
    },
}: {
    refresh: () => unknown;
    canManage: boolean;
    canDeleteOwner?: boolean;
    manager: Data['managers'][number];
}) {
    const surreal = useSurreal();
    const t = useTranslations(
        'pages.console.organisation.members.list_manager'
    );

    const { mutate: updateRole, isPending: isUpdatingRole } = useMutation({
        mutationKey: ['organisation', 'update-role', edge],
        mutationFn: async (role: Organisation['managers'][number]['role']) => {
            await surreal.merge(edge, {
                role,
            });

            await refresh();
        },
    });

    const { mutate: deleteManager, isPending: isDeletingManager } = useMutation(
        {
            mutationKey: ['organisation', 'delete-manager', edge],
            mutationFn: async () => {
                await surreal.delete(edge);
                await refresh();
            },
        }
    );

    return (
        <TableRow>
            <TableCell>
                <Avatar
                    profile={
                        {
                            id,
                            name,
                            profile_picture,
                        } as User
                    }
                />
            </TableCell>
            <TableCell>{name}</TableCell>
            <TableCell>{email}</TableCell>
            <TableCell>
                {!canManage || org ? (
                    role
                ) : isUpdatingRole ? (
                    <Skeleton className="h-10 w-24" />
                ) : (
                    <Select
                        onValueChange={updateRole}
                        defaultValue={role}
                        disabled={!canDeleteOwner && role == 'owner'}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('role.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="owner">
                                {t('role.roles.owner')}
                            </SelectItem>
                            <SelectItem value="administrator">
                                {t('role.roles.administrator')}
                            </SelectItem>
                            <SelectItem value="event_manager">
                                {t('role.roles.event_manager')}
                            </SelectItem>
                            <SelectItem value="event_viewer">
                                {t('role.roles.event_viewer')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </TableCell>
            <TableCell align="right">
                {!canManage ? null : org ? (
                    <Link
                        className={buttonVariants({ variant: 'outline' })}
                        href={`/organisation/${org.slug}/members`}
                    >
                        {t.rich('actions.via', {
                            org: () => org.name,
                        })}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                ) : isDeletingManager ? (
                    <Skeleton className="h-10 w-14" />
                ) : (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                variant="destructive"
                                disabled={!canDeleteOwner && role == 'owner'}
                            >
                                <Trash2 />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <h3 className="text-2xl font-bold">
                                {t.rich('actions.remove-dialog.title', {
                                    name: () => name,
                                })}
                            </h3>
                            <p>{t('actions.remove-dialog.description')}</p>
                            <div className="my-4 rounded-md border p-4">
                                <Profile
                                    profile={
                                        {
                                            id,
                                            name,
                                            profile_picture,
                                            email,
                                        } as User
                                    }
                                />
                            </div>
                            <div className="flex justify-end gap-4">
                                <DialogClose>
                                    <Button
                                        variant="outline"
                                        disabled={isDeletingManager}
                                    >
                                        {t('actions.remove-dialog.cancel')}
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteManager()}
                                    disabled={isDeletingManager}
                                >
                                    {isDeletingManager && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {t('actions.remove-dialog.submit')}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </TableCell>
        </TableRow>
    );
}

function InvitedManager({
    invite: { user, role, edge },
    canManage,
    refresh,
}: {
    invite: Invited;
    canManage: boolean;
    refresh: () => unknown;
}) {
    const surreal = useSurreal();
    const t = useTranslations(
        'pages.console.organisation.members.invited_manager'
    );

    const { mutate: updateRole, isPending: isUpdatingRole } = useMutation({
        mutationKey: ['organisation', 'update-role', edge],
        mutationFn: async (role: Organisation['managers'][number]['role']) => {
            await surreal.merge(edge, {
                role,
            });

            await refresh();
        },
    });

    const { mutate: revokeInvite, isPending: isRevokingInvite } = useMutation({
        mutationKey: ['organisation', 'revoke-invite', edge],
        mutationFn: async () => {
            await surreal.delete(edge);
            await refresh();
        },
    });

    return (
        <TableRow>
            <TableCell>
                <Avatar profile={user as User} />
            </TableCell>
            <TableCell>
                {user.name}{' '}
                <Badge className="ml-3">{t('pending-invite')}</Badge>
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
                {!canManage ? (
                    role
                ) : isUpdatingRole ? (
                    <Skeleton className="h-10 w-24" />
                ) : (
                    <Select onValueChange={updateRole} defaultValue={role}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('role.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="owner">
                                {t('role.roles.owner')}
                            </SelectItem>
                            <SelectItem value="administrator">
                                {t('role.roles.administrator')}
                            </SelectItem>
                            <SelectItem value="event_manager">
                                {t('role.roles.event_manager')}
                            </SelectItem>
                            <SelectItem value="event_viewer">
                                {t('role.roles.event_viewer')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </TableCell>
            <TableCell align="right">
                <Button
                    variant="destructive"
                    onClick={() => revokeInvite()}
                    disabled={isRevokingInvite}
                >
                    <MailX />
                </Button>
            </TableCell>
        </TableRow>
    );
}

function AddMember({
    organisation,
    refresh,
}: {
    organisation: Organisation['id'];
    refresh: () => unknown;
}) {
    const surreal = useSurreal();
    const [user, setUser] = useUserSelector();
    const [role, setRole] = useState('event_viewer');
    const [open, setOpen] = useState(false);
    const t = useTranslations('pages.console.organisation.members.add_member');

    const { mutateAsync, error } = useMutation({
        mutationKey: ['manages', 'invite'],
        async mutationFn() {
            // TODO set to correct type, not important for the moment
            await surreal.query<[string[]]>(
                /* surql */ `
                RELATE $user->manages->$organisation SET role = $role
            `,
                { user, role, organisation }
            );
            refresh();
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    {t('trigger')}
                    <Plus className="ml-2 h-6 w-6" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <h3 className="mb-4 text-2xl font-bold"> {t('title')}</h3>
                <div className="space-y-6">
                    <UserSelector
                        user={user}
                        setUser={setUser}
                        autoFocus
                        autoComplete="off"
                    />

                    <div className="space-y-3">
                        <Label htmlFor="role"> {t('role.label')}</Label>
                        <Select onValueChange={setRole} value={role}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue
                                    placeholder={t('role.placeholder')}
                                />
                            </SelectTrigger>
                            <SelectContent id="role">
                                <SelectItem value="owner">
                                    {t('role.roles.owner')}
                                </SelectItem>
                                <SelectItem value="administrator">
                                    {t('role.roles.administrator')}
                                </SelectItem>
                                <SelectItem value="event_manager">
                                    {t('role.roles.event_manager')}
                                </SelectItem>
                                <SelectItem value="event_viewer">
                                    {t('role.roles.event_viewer')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="mt-3">
                    <Button
                        disabled={!user || !role}
                        onClick={() => {
                            mutateAsync().then(() => {
                                setUser(undefined);
                                setRole('event_viewer');
                                setOpen(false);
                            });
                        }}
                    >
                        <Mail className="mr-2 h-4 w-4" />
                        {t('submit')}
                    </Button>
                </div>
                {!!error && <p>{(error as Error).message}</p>}
            </DialogContent>
        </Dialog>
    );
}

const Data = Organisation.extend({
    can_manage: z.boolean(),
    managers: z.array(
        z.object({
            user: User.pick({
                id: true,
                name: true,
                email: true,
                profile_picture: true,
            }),
            role: z.union([
                z.literal('owner'),
                z.literal('administrator'),
                z.literal('event_manager'),
                z.literal('event_viewer'),
            ]),
            edge: record('manages'),
            org: Organisation.optional(),
        })
    ),
});

type Data = z.infer<typeof Data>;

const Invited = z.object({
    user: UserAsRelatedUser,
    edge: record('manages'),
    role: z.union([
        z.literal('owner'),
        z.literal('administrator'),
        z.literal('event_manager'),
        z.literal('event_viewer'),
    ]),
});

type Invited = z.infer<typeof Invited>;

function useData(slug: Organisation['slug']) {
    const surreal = useSurreal();
    return useQuery({
        queryKey: ['organisation', 'members', slug],
        queryFn: async () => {
            const result = await surreal.query<[null[], Invited[], Data]>(
                /* surql */ `
                    LET $org = SELECT 
                        *,
                        $auth.id IN managers[WHERE role = "owner" OR (role = "administrator" AND org != NONE)].user AS can_manage
                    FROM ONLY organisation 
                        WHERE slug = $slug 
                        LIMIT 1
                        FETCH 
                            managers.*.user.*, 
                            managers.*.org.name;

                    SELECT in.* as user, id as edge, role
                        FROM $org.id<-manages[?!confirmed];

                    $org;  
                `,
                { slug }
            );

            if (!result?.[1] || !result?.[2]) return null;

            return {
                organisation: Data.parse(result[2]),
                invited_members: z.array(Invited).parse(result[1]),
            };
        },
    });
}
