using UnityEngine;

public class JewelVisual : MonoBehaviour
{
    [SerializeField] private MeshRenderer meshRenderer;
    [SerializeField] private Material[] jewelMaterials;

    private NodeGrid.Node.JewelType currentType;

    public void Initialize()
    {
        if (meshRenderer == null)
            meshRenderer = GetComponent<MeshRenderer>();
    }

    public void SetJewelType(NodeGrid.Node.JewelType type)
    {
        currentType = type;

        if (type == NodeGrid.Node.JewelType.None)
        {
            meshRenderer.enabled = false;
        }
        else
        {
            meshRenderer.enabled = true;
            
            int materialIndex = (int)type - 1;
            if (materialIndex >= 0 && materialIndex < jewelMaterials.Length)
            {
                meshRenderer.material = jewelMaterials[materialIndex];
            }
            else
            {
                Debug.LogError($"JewelVisual: Material index {materialIndex} out of range for type {type}. Array has {jewelMaterials.Length} materials.");
            }
        }
    }

    public NodeGrid.Node.JewelType GetJewelType()
    {
        return currentType;
    }
}