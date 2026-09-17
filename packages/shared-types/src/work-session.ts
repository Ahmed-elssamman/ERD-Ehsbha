export enum WorkSessionChange { Started = 'STARTED', Created = 'CREATED', Ended = 'ENDED', Corrected = 'CORRECTED', Deleted = 'DELETED', Restored = 'RESTORED' }
export enum WorkSessionView { Active = 'active', Deleted = 'deleted' }
export enum WorkSessionMutation { Start = 'session.start', End = 'session.end', Create = 'session.create', Correct = 'session.correct', Delete = 'session.delete', Restore = 'session.restore' }
