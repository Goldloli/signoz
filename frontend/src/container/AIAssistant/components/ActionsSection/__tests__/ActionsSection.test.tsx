import {
	ApplyFilterSignalDTO,
	MessageActionDTO,
	MessageActionKindDTO,
} from 'api/ai-assistant/sigNozAIAssistantAPI.schemas';
import { Querybuildertypesv5RequestTypeDTO } from 'api/generated/services/sigNoz.schemas';
import { QueryParams } from 'constants/query';
import { PANEL_TYPES } from 'constants/queryBuilder';
import ROUTES from 'constants/routes';
import { getCurrentLocation } from 'lib/router/navigation';
import { render, screen, userEvent, waitFor } from 'tests/test-utils';
import { QueryBuilderContextType } from 'types/common/queryBuilder';

import ActionsSection from '../ActionsSection';

jest.mock('api/common/logEvent', () => ({
	__esModule: true,
	default: jest.fn(),
}));

const START_MS = Date.UTC(2026, 6, 26, 10, 34);
const END_MS = Date.UTC(2026, 6, 26, 10, 49);

interface ActionOverrides {
	signal?: ApplyFilterSignalDTO;
	start?: number;
	end?: number;
}

// Labels differ per test: auto-applied filters are deduped module-wide by label.
function countByServiceAction(
	label: string,
	{ signal = ApplyFilterSignalDTO.logs, start, end }: ActionOverrides = {},
): MessageActionDTO {
	return {
		kind: MessageActionKindDTO.apply_filter,
		label,
		signal,
		query: {
			requestType: Querybuildertypesv5RequestTypeDTO.scalar,
			start,
			end,
			compositeQuery: {
				queries: [
					{
						type: 'builder_query',
						spec: {
							name: 'A',
							signal,
							aggregations: [{ expression: 'count()' }],
							groupBy: [{ name: 'service.name' }],
						},
					},
				],
			},
		},
	};
}

function currentParam(param: string): string | null {
	return new URLSearchParams(getCurrentLocation().search).get(param);
}

describe('ActionsSection apply_filter', () => {
	it('opens the explorer in the Table view when the chip is clicked from another page', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(
			<ActionsSection
				actions={[countByServiceAction('Open in Logs Explorer')]}
				messageId="message-1"
			/>,
			undefined,
			{ initialRoute: ROUTES.HOME },
		);

		await user.click(screen.getByTestId('ai-action-chip-apply_filter'));

		await waitFor(() =>
			expect(getCurrentLocation().pathname).toBe(ROUTES.LOGS_EXPLORER),
		);
		expect(currentParam(QueryParams.panelTypes)).toBe(
			JSON.stringify(PANEL_TYPES.TABLE),
		);
	});

	it.each([
		[ApplyFilterSignalDTO.logs, ROUTES.LOGS_EXPLORER],
		[ApplyFilterSignalDTO.traces, ROUTES.TRACES_EXPLORER],
		[ApplyFilterSignalDTO.metrics, ROUTES.METRICS_EXPLORER_EXPLORER],
	])(
		'opens the %s explorer on the time range that produced the answer',
		async (signal, route) => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			render(
				<ActionsSection
					actions={[
						countByServiceAction(`Open ${signal}`, {
							signal,
							start: START_MS,
							end: END_MS,
						}),
					]}
					messageId={`message-${signal}`}
				/>,
				undefined,
				{ initialRoute: ROUTES.HOME },
			);

			await user.click(screen.getByTestId('ai-action-chip-apply_filter'));

			await waitFor(() => expect(getCurrentLocation().pathname).toBe(route));
			expect(currentParam(QueryParams.startTime)).toBe(String(START_MS));
			expect(currentParam(QueryParams.endTime)).toBe(String(END_MS));
		},
	);

	it('still opens the explorer, without a time range, when the action has none', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(
			<ActionsSection
				actions={[countByServiceAction('Open without time')]}
				messageId="message-no-time"
			/>,
			undefined,
			{ initialRoute: ROUTES.HOME },
		);

		await user.click(screen.getByTestId('ai-action-chip-apply_filter'));

		await waitFor(() =>
			expect(getCurrentLocation().pathname).toBe(ROUTES.LOGS_EXPLORER),
		);
		expect(currentParam(QueryParams.compositeQuery)).not.toBeNull();
		expect(currentParam(QueryParams.startTime)).toBeNull();
		expect(currentParam(QueryParams.endTime)).toBeNull();
	});

	it('switches the open explorer to the Table view when applied on it', async () => {
		const redirectWithQueryBuilderData = jest.fn() as jest.MockedFunction<
			QueryBuilderContextType['redirectWithQueryBuilderData']
		>;
		const handleSetQueryData = jest.fn() as jest.MockedFunction<
			QueryBuilderContextType['handleSetQueryData']
		>;
		render(
			<ActionsSection
				actions={[countByServiceAction('Apply on Logs Explorer')]}
				messageId="message-2"
			/>,
			undefined,
			{
				initialRoute: ROUTES.LOGS_EXPLORER,
				queryBuilderOverrides: { redirectWithQueryBuilderData, handleSetQueryData },
			},
		);

		await waitFor(() =>
			expect(redirectWithQueryBuilderData).toHaveBeenCalledTimes(1),
		);
		expect(redirectWithQueryBuilderData).toHaveBeenCalledWith(
			expect.objectContaining({ builder: expect.anything() }),
			{ [QueryParams.panelTypes]: PANEL_TYPES.TABLE },
		);
	});
});
