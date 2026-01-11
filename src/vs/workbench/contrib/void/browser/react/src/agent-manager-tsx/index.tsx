import React from 'react';
import { AgentManager } from './AgentManager.js';
import { mountFnGenerator } from '../util/mountFnGenerator.js';

export const mountAgentManager = mountFnGenerator(AgentManager);

