import process from 'node:process';
import {setTimeout} from 'node:timers/promises';
import test from 'ava';
import isRunning from 'is-running';
import {execa} from '../../index.js';
import {setFixtureDirectory} from '../helpers/fixtures-directory.js';

setFixtureDirectory();

const pollForSubprocessExit = async pid => {
	while (isRunning(pid)) {
		// eslint-disable-next-line no-await-in-loop
		await setTimeout(100);
	}
};

test('signal 0 does not schedule forceful descendant termination', async t => {
	const subprocess = execa('ipc-send-pid.js', ['false', 'false'], {
		stdio: 'ignore',
		ipc: true,
		killDescendants: true,
		forceKillAfterDelay: 100,
	});
	const descendantPid = await subprocess.getOneMessage();

	t.teardown(() => {
		if (isRunning(subprocess.pid)) {
			subprocess.kill('SIGKILL');
		}

		if (isRunning(descendantPid)) {
			process.kill(descendantPid, 'SIGKILL');
		}
	});

	t.true(subprocess.kill(0));
	const settlement = await Promise.race([
		subprocess.then(() => 'resolved', () => 'rejected'),
		setTimeout(500, 'running'),
	]);

	t.is(settlement, 'running');
	t.true(isRunning(subprocess.pid));
	t.true(isRunning(descendantPid));

	subprocess.kill();
	await t.throwsAsync(subprocess);

	await Promise.race([
		setTimeout(1e4, undefined, {ref: false}),
		pollForSubprocessExit(descendantPid),
	]);
	t.false(isRunning(descendantPid));
});
