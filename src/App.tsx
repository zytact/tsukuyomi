import { useState, useEffect, useMemo } from 'react';
import './App.css';

interface ChromeTab {
    id?: number;
    title?: string;
    url?: string;
    favIconUrl?: string;
    discarded?: boolean;
    groupId: number;
}

interface ChromeTabGroup {
    id: number;
    title?: string;
    color: string;
    collapsed: boolean;
}

function App() {
    const [tabs, setTabs] = useState<ChromeTab[]>([]);
    const [tabGroups, setTabGroups] = useState<ChromeTabGroup[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
        null
    );

    // Cross-browser API detection
    const isFirefox = typeof (globalThis as any).browser !== 'undefined';
    const tabsAPI = isFirefox ? (globalThis as any).browser.tabs : chrome.tabs;
    const tabGroupsAPI = !isFirefox ? (chrome as any).tabGroups : undefined;
    const runtimeAPI = isFirefox
        ? (globalThis as any).browser.runtime
        : chrome.runtime;

    useEffect(() => {
        if (isFirefox) {
            tabsAPI
                .query({})
                .then((loadedTabs: ChromeTab[]) => {
                    setTabs(loadedTabs);
                })
                .catch((error: Error) => {
                    console.error(error.message);
                    setError(`Error fetching tabs: ${error.message}`);
                    setTabs([]);
                });
        } else {
            tabsAPI.query({}, (loadedTabs: ChromeTab[]) => {
                if (runtimeAPI.lastError) {
                    console.error(runtimeAPI.lastError.message);
                    setError(
                        `Error fetching tabs: ${runtimeAPI.lastError.message}`
                    );
                    setTabs([]);
                    return;
                }
                setTabs(loadedTabs);
            });

            if (tabGroupsAPI) {
                tabGroupsAPI.query({}, (groups: ChromeTabGroup[]) => {
                    if (runtimeAPI.lastError) {
                        console.error(
                            `Error fetching tab groups: ${runtimeAPI.lastError.message}`
                        );
                    } else {
                        setTabGroups(groups);
                    }
                });
            }
        }
    }, [isFirefox, tabsAPI, tabGroupsAPI, runtimeAPI]);

    const handleDiscardTab = (tabId: number | undefined) => {
        if (tabId) {
            if (isFirefox) {
                // Firefox - promise based
                tabsAPI
                    .discard(tabId)
                    .then(() => {
                        setTabs((prevTabs) =>
                            prevTabs.map((tab) =>
                                tab.id === tabId
                                    ? { ...tab, discarded: true }
                                    : tab
                            )
                        );
                    })
                    .catch((error: Error) => {
                        console.error(`Error discarding tab: ${error.message}`);
                    });
            } else {
                // Chrome - callback based
                tabsAPI.discard(tabId, () => {
                    if (runtimeAPI.lastError) {
                        console.error(
                            `Error discarding tab: ${runtimeAPI.lastError.message}`
                        );
                    } else {
                        setTabs((prevTabs) =>
                            prevTabs.map((tab) =>
                                tab.id === tabId
                                    ? { ...tab, discarded: true }
                                    : tab
                            )
                        );
                    }
                });
            }
        } else {
            console.error('Cannot discard tab: Tab ID is undefined.');
        }
    };

    const handleTabClick = (
        clickedIndex: number,
        event: React.MouseEvent<HTMLLIElement>
    ) => {
        const clickedTab = tabs[clickedIndex];

        if (!clickedTab || clickedTab.discarded) {
            return;
        }

        if (
            event.shiftKey &&
            lastSelectedIndex !== null &&
            lastSelectedIndex !== clickedIndex
        ) {
            event.preventDefault();
            const start = Math.min(lastSelectedIndex, clickedIndex);
            const end = Math.max(lastSelectedIndex, clickedIndex);

            for (let i = start; i <= end; i++) {
                const tabToDiscard = tabs[i];
                if (
                    tabToDiscard &&
                    !tabToDiscard.discarded &&
                    tabToDiscard.id !== undefined
                ) {
                    handleDiscardTab(tabToDiscard.id);
                }
            }
        } else {
            if (clickedTab.id !== undefined) {
                handleDiscardTab(clickedTab.id);
            }
        }

        setLastSelectedIndex(clickedIndex);
    };

    const handleDiscardGroup = (groupId: number) => {
        const groupTabs = tabs.filter((tab) => tab.groupId === groupId);
        groupTabs.forEach((tab) => {
            if (tab.id !== undefined && !tab.discarded) {
                handleDiscardTab(tab.id);
            }
        });
    };

    const getGroupedTabs = () => {
        const grouped: { [key: number]: ChromeTab[] } = {};
        const ungrouped: ChromeTab[] = [];

        tabs.forEach((tab) => {
            if (tab.groupId === -1 || tab.groupId === undefined) {
                ungrouped.push(tab);
            } else {
                if (!grouped[tab.groupId]) {
                    grouped[tab.groupId] = [];
                }
                grouped[tab.groupId].push(tab);
            }
        });

        return { grouped, ungrouped };
    };

    const getGroupColor = (color: string) => {
        const colors: { [key: string]: string } = {
            grey: 'bg-gray-500',
            blue: 'bg-blue-500',
            red: 'bg-red-500',
            yellow: 'bg-yellow-500',
            green: 'bg-green-500',
            pink: 'bg-pink-500',
            purple: 'bg-purple-500',
            cyan: 'bg-cyan-500',
            orange: 'bg-orange-500',
        };
        return colors[color] || 'bg-gray-500';
    };

    const { grouped, ungrouped } = useMemo(() => getGroupedTabs(), [tabs]);
    const groupIds = Object.keys(grouped).map(Number);
    const tabIndexMap = new Map(tabs.map((tab, idx) => [tab.id, idx]));

    return (
        <div className="App">
            <div className="mb-3 flex items-center justify-center">
                <img
                    src="icon.png"
                    alt="Logo"
                    className="mr-2 mb-0 size-10 p-1 pb-0"
                />
                <span className="text-lg font-bold">Tsukuyomi</span>
            </div>
            {error && <p className="text-red-500 dark:text-red-400">{error}</p>}
            {tabs.length > 0 ? (
                <div className="space-y-4">
                    {groupIds.map((groupId) => {
                        const group = tabGroups.find((g) => g.id === groupId);
                        const groupTabs = grouped[groupId];
                        const allDiscarded = groupTabs.every(
                            (tab) => tab.discarded
                        );

                        return (
                            <div
                                key={groupId}
                                className="rounded border border-gray-300 dark:border-gray-600"
                            >
                                <div className="flex items-center justify-between border-b border-gray-300 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`size-3 rounded-full ${group ? getGroupColor(group.color) : 'bg-gray-500'}`}
                                            aria-label={`Group color: ${group?.color || 'grey'}`}
                                        ></div>
                                        <span className="font-semibold">
                                            {group?.title || `Group ${groupId}`}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            ({groupTabs.length} tabs)
                                        </span>
                                    </div>
                                    <button
                                        onClick={() =>
                                            handleDiscardGroup(groupId)
                                        }
                                        disabled={allDiscarded}
                                        className={`rounded px-3 py-1 text-sm ${
                                            allDiscarded
                                                ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-600'
                                                : 'cursor-pointer bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                                        }`}
                                    >
                                        Discard Group
                                    </button>
                                </div>
                                <ul className="list-none p-0">
                                    {groupTabs.map((tab) => {
                                        const globalIndex =
                                            tabIndexMap.get(tab.id) ?? -1;
                                        return (
                                            <li
                                                key={tab.id || tab.url}
                                                className={`flex items-center border-b border-gray-200 p-2 last:border-b-0 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 ${tab.discarded ? 'opacity-50' : ''} ${!tab.discarded ? 'cursor-pointer' : 'cursor-not-allowed'} select-none`}
                                                onClick={(e) =>
                                                    handleTabClick(
                                                        globalIndex,
                                                        e
                                                    )
                                                }
                                            >
                                                {tab.favIconUrl && (
                                                    <img
                                                        src={tab.favIconUrl}
                                                        alt="favicon"
                                                        className="mr-2 size-4"
                                                        onError={(e) => {
                                                            (
                                                                e.target as HTMLImageElement
                                                            ).style.display =
                                                                'none';
                                                        }}
                                                    />
                                                )}
                                                <span>
                                                    {tab.title || 'No Title'}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}

                    {ungrouped.length > 0 && (
                        <div className="rounded border border-gray-300 dark:border-gray-600">
                            <div className="border-b border-gray-300 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
                                <span className="font-semibold">
                                    Ungrouped Tabs
                                </span>
                                <span className="ml-2 text-sm text-gray-500">
                                    ({ungrouped.length} tabs)
                                </span>
                            </div>
                            <ul className="list-none p-0">
                                {ungrouped.map((tab) => {
                                    const globalIndex =
                                        tabIndexMap.get(tab.id) ?? -1;
                                    return (
                                        <li
                                            key={tab.id || tab.url}
                                            className={`flex items-center border-b border-gray-200 p-2 last:border-b-0 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 ${tab.discarded ? 'opacity-50' : ''} ${!tab.discarded ? 'cursor-pointer' : 'cursor-not-allowed'} select-none`}
                                            onClick={(e) =>
                                                handleTabClick(globalIndex, e)
                                            }
                                        >
                                            {tab.favIconUrl && (
                                                <img
                                                    src={tab.favIconUrl}
                                                    alt="favicon"
                                                    className="mr-2 size-4"
                                                    onError={(e) => {
                                                        (
                                                            e.target as HTMLImageElement
                                                        ).style.display =
                                                            'none';
                                                    }}
                                                />
                                            )}
                                            <span>
                                                {tab.title || 'No Title'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                !error && <p>Loading tabs or no tabs found...</p>
            )}
        </div>
    );
}

export default App;
