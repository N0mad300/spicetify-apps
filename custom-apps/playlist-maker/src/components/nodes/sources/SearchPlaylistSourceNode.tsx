import type { Item } from '@shared/components/inputs/Select/Select';
import { TextComponent } from '@shared/components/ui/TextComponent/TextComponent';
import { searchDesktop } from '@shared/graphQL/queries/search-desktop';
import { getPlatform } from '@shared/utils/spicetify-utils';
import { useComboboxValues } from 'custom-apps/playlist-maker/src/hooks/use-combobox-values';
import { useNodeForm } from 'custom-apps/playlist-maker/src/hooks/use-node-form';
import {
    PlaylistDataSchema,
    type PlaylistData,
} from 'custom-apps/playlist-maker/src/models/nodes/sources/playlist-tracks-source-processor';
import { getDefaultValueForNodeType } from 'custom-apps/playlist-maker/src/utils/node-utils';
import { Music } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { type ItemRendererProps } from '../../inputs/ComboBox';
import { ComboBoxController } from '../../inputs/ComboBoxController';
import { NumberController } from '../../inputs/NumberController';
import { SelectController } from '../../inputs/SelectController';
import { TextController } from '../../inputs/TextController';
import { Node } from '../shared/Node';
import { NodeComboField } from '../shared/NodeComboField';
import { NodeContent } from '../shared/NodeContent';
import { NodeField } from '../shared/NodeField';
import { SourceNodeHeader } from '../shared/NodeHeader';
import { NodeTitle } from '../shared/NodeTitle';

const propertyItems: Item<PlaylistData['sortField']>[] = [
    { value: 'ALBUM', label: 'Album' },
    { value: 'ARTIST', label: 'Artist' },
    { value: 'TITLE', label: 'Name' },
    { value: 'DURATION', label: 'Duration' },
    { value: 'ADDED_AT', label: 'Added at' },
    { value: 'ADDED_BY', label: 'Added by' },
    { value: 'PUBLISH_DATE', label: 'Publish date' },
    { value: 'SHOW_NAME', label: 'Show name' },
    { value: 'NO_SORT', label: 'No sort' },
];

const orderItems: Item<PlaylistData['sortOrder']>[] = [
    { value: 'ASC', label: 'Ascending' },
    { value: 'DESC', label: 'Descending' },
];

type PlaylistItem = {
    id: string;
    uri: string;
    name: string;
    image: string | null;
    ownerName: string;
};

function PlaylistItemRenderer(
    props: Readonly<ItemRendererProps<PlaylistItem>>,
): JSX.Element {
    return (
        <div className="flex max-h-[80px] items-stretch gap-2">
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center !p-2">
                {props.item.image && (
                    <img
                        src={props.item.image}
                        className="rounded-md object-contain"
                        alt="playlist"
                    />
                )}
                {props.item.image === null && (
                    <Music size={60} strokeWidth={1} />
                )}
            </div>

            <div className="flex min-w-0 flex-col items-stretch justify-center">
                <span
                    className={Spicetify.classnames(
                        'truncate',
                        props.isSelected ? 'font-bold' : '',
                    )}
                >
                    {props.item.name}
                </span>
                <span className="truncate text-sm">
                    by {props.item.ownerName}
                </span>
            </div>
        </div>
    );
}

export function SearchPlaylistSourceNode(
    props: Readonly<NodeProps<PlaylistData>>,
): JSX.Element {
    const { playlistUri } = props.data;

    const { errors, control, updateNodeField } = useNodeForm<PlaylistData>(
        props.id,
        props.data,
        getDefaultValueForNodeType('searchPlaylistSource'),
        PlaylistDataSchema,
    );

    const getPlaylists = useCallback(
        async (input: string): Promise<PlaylistItem[]> => {
            if (!input.trim()) {
                return [];
            }

            const search = await searchDesktop({
                searchTerm: input,
                offset: 0,
                limit: 20,
                includePreReleases: true,
                includeArtistHasConcertsField: false,
                includeAudiobooks: false,
                includeLocalConcertsField: false,
                numberOfTopResults: 5,
            });

            const items: PlaylistItem[] = search.searchV2.playlists.items.map(
                (playlist) => ({
                    id: playlist.data.uri,
                    uri: playlist.data.uri,
                    name: playlist.data.name,
                    image:
                        playlist.data.images.items[0]?.sources[0].url ?? null,
                    ownerName: playlist.data.ownerV2.data.name,
                }),
            );

            return items;
        },
        [],
    );

    const getPlaylist = useCallback(
        async (playlistUri: string): Promise<PlaylistItem | null> => {
            const playlistApi = getPlatform().PlaylistAPI;

            try {
                const playlist = await playlistApi.getPlaylist(
                    playlistUri,
                    {},
                    {},
                );

                const playlistItem: PlaylistItem = {
                    id: playlist.metadata.uri,
                    name: playlist.metadata.name,
                    uri: playlist.metadata.uri,
                    image:
                        playlist.metadata.images.length > 0
                            ? playlist.metadata.images[0].url
                            : null,
                    ownerName: playlist.metadata.owner.displayName,
                };

                return playlistItem;
            } catch (e) {
                console.error('Failed to fetch playlist', e);
                updateNodeField({ playlistUri: '' });

                return null;
            }
        },
        [updateNodeField],
    );

    const itemToString = useCallback(
        (item: PlaylistItem): string => item.name,
        [],
    );

    const {
        inputValue,
        items,
        onInputChanged,
        onItemSelected,
        resetSelection,
        selectedItem,
        syncInputWithSelectedItem,
        onSelectedIdChanged,
    } = useComboboxValues<PlaylistItem>(
        getPlaylist,
        getPlaylists,
        itemToString,
        (item) => {
            updateNodeField({ playlistUri: item?.uri ?? '' });
        },
    );

    useEffect(() => {
        void onSelectedIdChanged(playlistUri);
    }, [playlistUri, onSelectedIdChanged]);

    return (
        <Node isExecuting={props.data.isExecuting} isSelected={props.selected}>
            <SourceNodeHeader />

            <NodeContent>
                <NodeTitle
                    title="Playlist"
                    tooltip="Search for a playlist using Spotify's search. You can use advanced search tags sush as 'genre:' or 'year:'."
                />

                <NodeComboField error={errors.playlistUri}>
                    <ComboBoxController
                        control={control}
                        name="playlistUri"
                        selectedItem={selectedItem}
                        onItemSelected={onItemSelected}
                        items={items}
                        itemRenderer={PlaylistItemRenderer}
                        itemToString={itemToString}
                        label="Playlist"
                        placeholder="Search for a playlist"
                        inputValue={inputValue}
                        onInputChanged={onInputChanged}
                        onClear={resetSelection}
                        onBlur={syncInputWithSelectedItem}
                    />
                </NodeComboField>
                <TextComponent
                    elementType="p"
                    fontSize="small"
                    semanticColor="textSubdued"
                >
                    Selected:{' '}
                    {props.data.playlistUri === ''
                        ? '-'
                        : props.data.playlistUri}
                </TextComponent>

                <NodeField
                    tooltip="Search filter to apply"
                    label="Filter"
                    error={errors.filter}
                >
                    <TextController
                        placeholder="Search"
                        name="filter"
                        control={control}
                        onChange={(value) => {
                            updateNodeField({ filter: value });
                        }}
                    />
                </NodeField>

                <NodeField
                    label="Offset"
                    tooltip="Number of elements to skip"
                    error={errors.offset}
                >
                    <NumberController
                        placeholder="0"
                        control={control}
                        name="offset"
                        onChange={(value) => {
                            updateNodeField({ offset: value });
                        }}
                    />
                </NodeField>

                <NodeField
                    label="Limit"
                    tooltip="Number of elements to take. Leave empty to take all elements."
                    error={errors.limit}
                >
                    <NumberController
                        placeholder="None"
                        control={control}
                        name="limit"
                        onChange={(value) => {
                            updateNodeField({ limit: value });
                        }}
                    />
                </NodeField>

                <NodeField label="Sort by" error={errors.sortField}>
                    <SelectController
                        label="Property to sort on"
                        name="sortField"
                        control={control}
                        items={propertyItems}
                        onChange={(value) => {
                            updateNodeField({
                                sortField: value,
                            });
                        }}
                    />
                </NodeField>
                <NodeField label="Order" error={errors.sortOrder}>
                    <SelectController
                        label="Sort order"
                        name="sortOrder"
                        control={control}
                        items={orderItems}
                        onChange={(value) => {
                            updateNodeField({
                                sortOrder: value,
                            });
                        }}
                    />
                </NodeField>
            </NodeContent>
            <Handle
                type="source"
                position={Position.Right}
                id="result"
                style={{ top: '40px' }}
            />
        </Node>
    );
}
