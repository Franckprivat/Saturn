export const auth = {
  api: {
    getSession: jest.fn().mockResolvedValue(null),
  },
  handler: jest.fn().mockReturnValue(jest.fn()),
};
