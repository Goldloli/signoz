import { SavedviewtypesSourceDTO } from 'api/generated/services/sigNoz.schemas';
import { TelemetryFieldKey } from 'api/v5/v5';
import { LOCALSTORAGE } from 'constants/localStorage';
import { PANEL_TYPES } from 'constants/queryBuilder';
import ROUTES from 'constants/routes';
import { TRACE_VIEW_DEFAULT_COLUMNS } from 'container/LLMObservability/Explorer/constants';
import { defaultTraceSelectedColumns } from 'container/OptionsMenu/constants';
import { render, screen, userEvent } from 'tests/test-utils';

import { usePreferenceContext } from '../context/PreferenceContextProvider';
import { PanelColumns, PreferenceSourcePage } from '../types';

const ROUTE_TRACES = '/traces';
const ROUTE_AI = '/ai-observability';
const TESTID_TRACES = 'traces';
const TESTID_AI = 'ai';
const AI_DEFAULT_COUNT = String(TRACE_VIEW_DEFAULT_COLUMNS.length);
const URL_COLUMNS = [{ name: 'ai.url.a' }, { name: 'ai.url.b' }];

type TracesLocalOptions = {
	selectColumns?: TelemetryFieldKey[];
};

function setLocalStorageJSON(key: string, value: unknown): void {
	localStorage.setItem(key, JSON.stringify(value));
}

function getLocalStorageJSON<T>(key: string): T | null {
	const raw = localStorage.getItem(key);
	return raw ? (JSON.parse(raw) as T) : null;
}

function Consumer({
	sourcePage,
	testIdPrefix,
}: {
	sourcePage: PreferenceSourcePage;
	testIdPrefix: string;
}): JSX.Element {
	const slice = usePreferenceContext()[sourcePage];

	return (
		<div>
			<div data-testid={`${testIdPrefix}-columns-len`}>
				{String(slice.preferences?.columns?.length || 0)}
			</div>
			<button
				data-testid={`${testIdPrefix}-update-columns`}
				type="button"
				onClick={(): void => {
					slice.updateColumns(
						defaultTraceSelectedColumns.slice(0, 1) as TelemetryFieldKey[],
					);
				}}
			>
				update
			</button>
		</div>
	);
}

function renderAiConsumer(): void {
	render(
		<Consumer
			sourcePage={SavedviewtypesSourceDTO.ai_observability}
			testIdPrefix={TESTID_AI}
		/>,
		undefined,
		{ initialRoute: ROUTE_AI },
	);
}

function renderAtUrl(
	pathname: string,
	params: Record<string, unknown>,
	renderConsumer: () => void,
): void {
	const search = new URLSearchParams(
		Object.entries(params).map(([key, value]) => [key, JSON.stringify(value)]),
	).toString();
	const originalLocation = window.location;
	Object.defineProperty(window, 'location', {
		writable: true,
		value: { ...originalLocation, pathname, search: `?${search}` },
	});

	renderConsumer();

	Object.defineProperty(window, 'location', {
		writable: true,
		value: originalLocation,
	});
}

function renderAiAtUrl(params: Record<string, unknown>): void {
	renderAtUrl(ROUTES.AI_OBSERVABILITY_EXPLORER, params, renderAiConsumer);
}

describe('PreferencesProvider AI observability', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('loading', () => {
		it('starts with the default trace view columns', () => {
			renderAiConsumer();

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent(
				AI_DEFAULT_COUNT,
			);
		});

		it('loads the url columns for the panel in panelTypes', () => {
			renderAiAtUrl({
				options: { selectColumns: URL_COLUMNS },
				panelTypes: PANEL_TYPES.TRACE,
			});

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('2');
		});

		it('prefers its localStorage over the url options', () => {
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.TRACE]: [{ name: 'ai.local.col' }],
			});

			renderAiAtUrl({
				options: { selectColumns: URL_COLUMNS },
				panelTypes: PANEL_TYPES.TRACE,
			});

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('1');
		});

		it('falls back to the url options when every stored column is invalid', () => {
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.TRACE]: [{ name: 'logs.col', signal: 'logs' }],
			});

			renderAiAtUrl({
				options: { selectColumns: URL_COLUMNS },
				panelTypes: PANEL_TYPES.TRACE,
			});

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('2');
		});

		it('loads the columns of the panel open in the url', () => {
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.TRACE]: [{ name: 'ai.trace.a' }, { name: 'ai.trace.b' }],
				[PANEL_TYPES.LIST]: [{ name: 'ai.list.col' }],
			});

			render(
				<Consumer
					sourcePage={SavedviewtypesSourceDTO.ai_observability}
					testIdPrefix={TESTID_AI}
				/>,
				undefined,
				{
					initialRoute: `${ROUTE_AI}?panelTypes=${encodeURIComponent(
						JSON.stringify(PANEL_TYPES.LIST),
					)}`,
				},
			);

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('1');
		});
	});

	describe('url', () => {
		it('ignores the url options on other explorers', () => {
			renderAtUrl(
				ROUTE_TRACES,
				{ options: { selectColumns: URL_COLUMNS } },
				renderAiConsumer,
			);

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent(
				AI_DEFAULT_COUNT,
			);
		});

		it('files the url columns under the panel in panelTypes', () => {
			renderAiAtUrl({
				options: { selectColumns: URL_COLUMNS },
				panelTypes: PANEL_TYPES.LIST,
			});

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent(
				AI_DEFAULT_COUNT,
			);
		});

		it('keeps its url columns out of the traces slice', () => {
			renderAtUrl(
				ROUTES.AI_OBSERVABILITY_EXPLORER,
				{
					options: { selectColumns: URL_COLUMNS },
					panelTypes: PANEL_TYPES.TRACE,
				},
				(): void => {
					render(
						<Consumer
							sourcePage={SavedviewtypesSourceDTO.traces}
							testIdPrefix={TESTID_TRACES}
						/>,
						undefined,
						{ initialRoute: ROUTE_AI },
					);
				},
			);

			expect(screen.getByTestId('traces-columns-len')).toHaveTextContent(
				String(defaultTraceSelectedColumns.length),
			);
		});
	});

	describe('storage', () => {
		it('loads its own localStorage, not the traces list one', () => {
			setLocalStorageJSON(LOCALSTORAGE.TRACES_LIST_OPTIONS, {
				selectColumns: [{ name: 'traces.list.col' }],
			});
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.TRACE]: [{ name: 'ai.col.a' }, { name: 'ai.col.b' }],
			});

			renderAiConsumer();

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('2');
		});

		it('drops stored columns without a name or from another signal', () => {
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.TRACE]: [
					{ name: 'ai.col.a' },
					{ name: 'logs.col', signal: 'logs' },
					{ key: 'no.name' },
					{},
					'not-a-column',
				],
			});

			renderAiConsumer();

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('1');
		});

		it('ignores a stored panel that is not a list', () => {
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.TRACE]: 'ai.col.a',
			});

			renderAiConsumer();

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent(
				AI_DEFAULT_COUNT,
			);
		});

		it('keeps each panel apart in its localStorage', () => {
			setLocalStorageJSON(LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS, {
				[PANEL_TYPES.LIST]: [{ name: 'ai.list.col' }],
			});

			renderAiConsumer();

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent(
				AI_DEFAULT_COUNT,
			);
		});

		it('updateColumns writes its own localStorage key in direct mode', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			renderAiConsumer();

			await user.click(screen.getByTestId('ai-update-columns'));

			expect(screen.getByTestId('ai-columns-len')).toHaveTextContent('1');
			expect(
				getLocalStorageJSON<PanelColumns>(
					LOCALSTORAGE.AI_OBSERVABILITY_PANEL_COLUMNS,
				)?.[PANEL_TYPES.TRACE],
			).toHaveLength(1);
			expect(
				getLocalStorageJSON<TracesLocalOptions>(LOCALSTORAGE.TRACES_LIST_OPTIONS),
			).toBeNull();
		});
	});
});
