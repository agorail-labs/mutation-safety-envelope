// Author-controlled fixtures. None of these amounts or policies came from a merchant.
export const CAPABILITY = 'com.example.order_modification';
export const VERSION = '0.0.0-experimental';
export const PARENT = { name: 'dev.ucp.shopping.order', version: '2026-08-25' };
export const READ = 'dev.ucp.shopping.order:read';
export const MANAGE = 'dev.ucp.shopping.order:manage';
export const buyer = () => ({ platform: 'platform-a', buyer: 'buyer-a', scopes: [READ, MANAGE] });
export const business = () => ({ business: 'business-a' });

export function fixture({ atomicity = 'per_unit', granularity = 'by_unit', review = false } = {}) {
  return {
    business: 'business-a', owner: 'buyer-a', supported: true,
    atomicity, granularity, wholeAvailable: true, wholeMode: review ? 'merchant_review' : 'immediate',
    wholeEstimate: 4900, wholeAmount: 5500,
    units: [
      { id: 'goods-a', line: 'line-a', quantity: 2, amount: 3000, estimate: 2700,
        mode: 'immediate', supported: true, policy: true, requires: [] },
      { id: 'goods-b', line: 'line-b', quantity: 1, amount: 2000, estimate: 1800,
        mode: review ? 'merchant_review' : 'immediate', supported: true, policy: true, requires: [] },
      // A retained delivery component is not a fictional merchandise line.
      { id: 'delivery', expectation: 'fulfillment-a', amount: 500, estimate: 400,
        mode: 'immediate', supported: false, policy: true, requires: [] }
    ],
    order: {
      id: 'order-a', checkout_id: 'checkout-a', permalink_url: 'https://business.example/orders/order-a',
      currency: 'USD', totals: [{ type: 'total', amount: 5500 }],
      line_items: [
        { id: 'line-a', item: { id: 'sku-a', title: 'Example A', price: 1500 },
          totals: [{ type: 'total', amount: 3000 }], quantity: { original: 2, total: 2, fulfilled: 0 }, status: 'processing' },
        { id: 'line-b', item: { id: 'sku-b', title: 'Example B', price: 2000 },
          totals: [{ type: 'total', amount: 2000 }], quantity: { original: 1, total: 1, fulfilled: 0 }, status: 'processing' }
      ], fulfillment: { expectations: [{ id: 'fulfillment-a', line_items: [
        { id: 'line-a', quantity: 2 }, { id: 'line-b', quantity: 1 }
      ], method_type: 'shipping', destination: { address_country: 'US', address_locality: 'Example City' }
      }], events: [] }, adjustments: []
    }
  };
}

export const request = (version, ids = ['goods-a']) => JSON.stringify({
  base_order_version: version,
  operations: ids.map(id => ({ op: 'cancel', target: id === '$order' ? { type: 'order' } : { type: 'unit', id } }))
});
