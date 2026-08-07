import { describe, expect, it } from 'vitest';

import type { MerchantAliasRegistry } from './merchant-alias-registry';
import { resolveMerchantName } from './merchant-name-resolver';

describe('resolveMerchantName', () => {
  it.each([
    ['지에쓰이십오 대전법동점', 'GS25 대전법동점'],
    ['지에스25 한남대점', 'GS25 한남대점'],
    ['씨유 한남대점', 'CU 한남대점'],
    ['메가엠지씨커피 대전법동점', '메가MGC커피 대전법동점'],
    ['지에쓰25', 'GS25'],
    ['세븐일레븐 한남점', '7-ELEVEN 한남점'],
    ['7일레븐 법동점', '7-ELEVEN 법동점'],
    ['메가커피 법동점', '메가MGC커피 법동점'],
  ])('resolves the fabricated alias %s while preserving its branch', (input, expected) => {
    expect(resolveMerchantName(input)).toMatchObject({
      source: 'ALIAS',
      confidence: 'HIGH',
      canonicalQuery: expected,
      canSearchKakao: true,
    });
  });

  it.each([
    ['GS25 한남대점', 'GS25 한남대점'],
    ['CU', 'CU'],
    ['7-ELEVEN', '7-ELEVEN'],
    ['메가MGC커피', '메가MGC커피'],
  ])('recognizes the canonical brand %s as an exact merchant', (input, expected) => {
    expect(resolveMerchantName(input)).toMatchObject({
      source: 'EXACT',
      confidence: 'HIGH',
      canonicalQuery: expected,
    });
  });

  it('uses fuzzy matching only after exact aliases fail', () => {
    expect(resolveMerchantName('메가엠지시커피 대전법동점')).toMatchObject({
      source: 'FUZZY',
      confidence: 'MEDIUM',
      matchedAlias: '메가엠지씨커피',
      canonicalQuery: '메가MGC커피 대전법동점',
    });
    expect(resolveMerchantName('메가엠지씨커피 대전법동점')).toMatchObject({
      source: 'ALIAS',
      confidence: 'HIGH',
    });
  });

  it('keeps short, low-similarity, and tied candidates in review', () => {
    const ambiguousRegistry: MerchantAliasRegistry = [
      { canonical: 'Fabricated A', aliases: ['abcdef'] },
      { canonical: 'Fabricated B', aliases: ['abcxef'] },
    ];

    expect(resolveMerchantName('CV 한남점')).toMatchObject({
      source: 'REVIEW',
      reviewReason: 'NO_KNOWN_MERCHANT',
    });
    expect(resolveMerchantName('Completely Different')).toMatchObject({
      source: 'REVIEW',
      reviewReason: 'NO_KNOWN_MERCHANT',
    });
    expect(
      resolveMerchantName('abcqef 지점', ambiguousRegistry),
    ).toMatchObject({
      source: 'REVIEW',
      reviewReason: 'AMBIGUOUS_FUZZY_MATCH',
    });
  });

  it('does not replace a short brand inside an unrelated merchant', () => {
    expect(resolveMerchantName('CUBE Fabricated Store')).toMatchObject({
      source: 'REVIEW',
      canonicalQuery: 'CUBE Fabricated Store',
    });
    expect(resolveMerchantName('가짜CU상사')).toMatchObject({
      source: 'REVIEW',
      canonicalQuery: '가짜CU상사',
    });
  });

  it('excludes PAYCO orders before alias or fuzzy resolution', () => {
    expect(resolveMerchantName('PAYCO오더')).toMatchObject({
      source: 'REVIEW',
      confidence: 'REVIEW',
      canSearchKakao: false,
      reviewReason: 'PAYMENT_INTERMEDIARY',
    });
  });
});
