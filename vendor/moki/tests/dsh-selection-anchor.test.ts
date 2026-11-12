import {describe, expect, it} from 'vitest';
import {selectionActionPosition} from '../src/web/dsh-selection-anchor.js';

describe('floating selection action', () => {
  it('stays outside resize handles and moves to the left at the right canvas edge', () => {
    expect(selectionActionPosition({left:100,top:200,width:120,height:60},800,600)).toEqual({left:238,top:198});
    expect(selectionActionPosition({left:650,top:200,width:120,height:60},800,600)).toEqual({left:600,top:198});
  });
  it('clamps a large selection into a narrow workspace, above the bottom tools', () => {
    expect(selectionActionPosition({left:-100,top:500,width:500,height:100},320,600)).toEqual({left:280,top:524});
    expect(selectionActionPosition({left:10,top:0,width:20,height:20},320,600)?.top).toBe(52);
  });
  it('does not leave a floating action for an entirely offscreen selection', () => {
    expect(selectionActionPosition({left:-200,top:100,width:100,height:80},320,600)).toBeUndefined();
    expect(selectionActionPosition({left:400,top:100,width:100,height:80},320,600)).toBeUndefined();
    expect(selectionActionPosition({left:20,top:700,width:100,height:80},320,600)).toBeUndefined();
  });
});
