import { PrismaPg } from "@prisma/adapter-pg";

type PgAdapter = Awaited<ReturnType<PrismaPg["connect"]>>;
type PgTransaction = Awaited<ReturnType<PgAdapter["startTransaction"]>>;

/**
 * PrismaPg whose interactive transactions run one query at a time. Prisma's query compiler loads
 * sibling `include` relations in parallel, and inside a transaction they all share one pg client;
 * pg 8 queues them itself but warns that this is removed in pg 9. Queueing here keeps the same
 * order without relying on that behavior.
 */
export class SerializedPrismaPg extends PrismaPg {
  async connect() {
    return serializeTransactions(await super.connect());
  }

  async connectToShadowDb() {
    return serializeTransactions(await super.connectToShadowDb());
  }
}

function serializeTransactions(adapter: PgAdapter): PgAdapter {
  const startTransaction = adapter.startTransaction.bind(adapter);
  adapter.startTransaction = async (isolationLevel) => serializeQueries(await startTransaction(isolationLevel));
  return adapter;
}

function serializeQueries(transaction: PgTransaction): PgTransaction {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(run: () => Promise<T>): Promise<T> => {
    const result = tail.then(run);
    tail = result.catch(() => undefined);
    return result;
  };
  const queryRaw = transaction.queryRaw.bind(transaction);
  const executeRaw = transaction.executeRaw.bind(transaction);
  transaction.queryRaw = (query) => enqueue(() => queryRaw(query));
  transaction.executeRaw = (query) => enqueue(() => executeRaw(query));
  return transaction;
}
