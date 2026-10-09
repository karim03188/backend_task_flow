import { buildPaginationMeta, paginate } from './pagination.util';

describe('pagination util', () => {
  it('computes metadata for a first page with more pages', () => {
    expect(buildPaginationMeta(1, 10, 25)).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('computes metadata for a middle page', () => {
    expect(buildPaginationMeta(2, 10, 25)).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('handles an empty result set without dividing by zero', () => {
    expect(buildPaginationMeta(1, 10, 0)).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('wraps data and meta', () => {
    expect(paginate([1, 2], 1, 2, 2)).toEqual({
      data: [1, 2],
      meta: {
        page: 1,
        limit: 2,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });
});
