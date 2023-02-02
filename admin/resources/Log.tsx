import React from 'react';
import { List, Datagrid, TextField, Resource, DateField } from 'react-admin';
import { JsonField } from 'react-admin-json-view';

export const LogList = () => (
    <List sort={{ field: 'created', order: 'DESC' }}>
        <Datagrid>
            <TextField source="id" />
            <TextField source="event" />
            <TextField source="field" />
            <TextField source="from" />
            <TextField source="to" />
            <JsonField
                source="details"
                reactJsonOptions={{
                    // Props passed to react-json-view
                    name: null,
                    collapsed: true,
                    enableClipboard: false,
                    displayDataTypes: false,
                }}
            />
            <DateField source="created" />
        </Datagrid>
    </List>
);

export const LogResource = <Resource name="log" list={LogList} />;