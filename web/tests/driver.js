// Piloto de testes do modo jogo: joga como um jogador faria (toques no canvas, botoes do painel).
// Uso (console do navegador, com a pagina principal aberta):
//   const { installDriver } = await import("/web/tests/driver.js"); installDriver();
// Depois: __drv.est() (pergunta atual), __drv.pointFor(estrutura), __drv.click(x, y), __drv.playRound({...})
export function installDriver() {
  const { state, camera, renderer, THREE, game } = window.__debug;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const idOf = (name) => {
    const m = /^(.*)\.([a-zA-Z0-9]{1,3})$/.exec(name.trim());
    const b = m && m[2].length <= 3 ? m[1].trim() : name.trim();
    return b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "-");
  };
  const D = {
    sleep, idOf,
    est: () => game.__estado(),
    stackAt(x, y) {
      const rect = renderer.domElement.getBoundingClientRect();
      const pick = [];
      for (const cat of Object.values(state.categories)) if (cat.root && cat.root.visible) cat.root.traverse((c) => { if (c.isMesh && c.visible) pick.push(c); });
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
      const seen = new Set(), out = [];
      for (const h of rc.intersectObjects(pick, false)) { if (seen.has(h.object.name)) continue; seen.add(h.object.name); out.push(h.object.name); }
      return out;
    },
    // ponto da tela onde a estrutura aparece na pilha de pecas (idx = quantos toques ate alcanca-la)
    pointFor(structure) {
      const rect = renderer.domElement.getBoundingClientRect();
      camera.updateMatrixWorld(true);
      let best = null;
      for (const o of structure.objetos) {
        if (o.papel === "fixacao") continue;
        const m = state.categories[o.categoria_app]?.objects.get(o.nome);
        if (!m || !m.visible) continue;
        const g = m.geometry, pos = g.attributes.position;
        const tc = g.index ? g.index.count / 3 : pos.count / 3, step = Math.max(1, Math.floor(tc / 60));
        const v = new THREE.Vector3();
        for (let t = 0; t < tc; t += step) {
          const ia = g.index ? g.index.getX(t * 3) : t * 3;
          v.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld).project(camera);
          if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
          const x = (v.x * 0.5 + 0.5) * rect.width + rect.left, y = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
          const stack = D.stackAt(x, y);
          const idx = stack.findIndex((n) => idOf(n) === structure.id);
          if (idx >= 0 && (!best || idx < best.idx)) { best = { x, y, idx, total: stack.length }; if (idx === 0) return best; }
        }
      }
      return best;
    },
    click(x, y) { renderer.domElement.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })); },
    // responde a pergunta atual: certo=true acerta, false erra de proposito
    async answer(certo) {
      const e = D.est(), q = e.q, cand = e.round.cands[e.round.i];
      if (q.tipo === "encontre") {
        const s = e.data.byId.get(cand.id);
        const pt = D.pointFor(s);
        if (certo && pt) { for (let k = 0; k <= pt.idx; k++) D.click(pt.x, pt.y); }
        else {
          let other = null;
          for (const o of e.data.jogaveis.filter((j) => j.regiao === e.regionId && j.id !== s.id)) { const p = D.pointFor(o); if (p && p.idx === 0) { other = p; break; } }
          if (other) D.click(other.x, other.y); else { document.querySelector(".q-actions .game-btn.ghost").click(); return; }
        }
        await sleep(120);
        document.getElementById("q-confirm").click();
      } else {
        document.querySelectorAll(".q-option")[certo ? q.correta : (q.correta + 1) % q.opcoes.length].click();
      }
    },
    async next() {
      await sleep(200);
      const b = [...document.querySelectorAll("#q-feedback .game-btn")].find((x) => /Próxima|resultado/.test(x.textContent));
      if (b) b.click();
      await sleep(900);
    },
  };
  window.__drv = D;
  return D;
}
