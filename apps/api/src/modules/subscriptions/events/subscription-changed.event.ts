/** Emitted when a client gets a (new) plan — triggers the PPPoE profile change. */
export class SubscriptionChangedEvent {
  static readonly EVENT_NAME = 'subscription.changed';

  constructor(
    public readonly clientId: string,
    public readonly subscriptionId: string,
    public readonly planName: string,
  ) {}
}
