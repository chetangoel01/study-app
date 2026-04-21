import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateModal } from './CreateModal.js';

const peer = { id: '2', fullName: 'Bob B.', initials: 'BB', defaultRolePreference: 'interviewee' as const };

describe('CreateModal', () => {
  it('pre-fills role from defaultRolePreference', () => {
    render(
      <CreateModal
        peers={[peer]}
        defaultRolePreference="interviewer"
        onClose={() => {}}
        onScheduleInvite={async () => ({ id: '1' })}
        onPostAvailability={async () => ({ proposalId: '1' })}
      />
    );
    const interviewerBtn = screen.getByRole('radio', { name: /I want to interview/i });
    expect(interviewerBtn).toBeChecked();
  });

  it('submits multi-block availability with N blocks', async () => {
    const onPostAvailability = vi.fn().mockResolvedValue({ proposalId: '77' });
    render(
      <CreateModal
        peers={[peer]}
        defaultRolePreference="either"
        onClose={() => {}}
        onScheduleInvite={async () => ({ id: '1' })}
        onPostAvailability={onPostAvailability}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Post availability/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Add block/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Add block/i }));
    fireEvent.click(screen.getByRole('button', { name: /Post 3 block/i }));
    await waitFor(() => expect(onPostAvailability).toHaveBeenCalledTimes(1));
    const [call] = onPostAvailability.mock.calls[0];
    expect(call.blocks).toHaveLength(3);
  });
});
